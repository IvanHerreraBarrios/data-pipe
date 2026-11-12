const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const PDFDocument = require('pdfkit');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const SERVICE_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || "datapipe-download";

const writeLog = (level, message, data = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: level,
        service: SERVICE_NAME,
        message: message,
        ...data
    }));
};

exports.handler = async (event) => {
    writeLog("INFO", "Solicitud de exportación de reporte recibida");

    try {
        const batchId = event.pathParameters?.batchId;
        const exportType = event.queryStringParameters?.type || 'json';

        if (!batchId) {
            writeLog("WARN", "Falta parámetro batchId en la petición de descarga");
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "BatchId is required in path parameters" })
            };
        }

        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": `BATCH#${batchId}`
            }
        }));

        const items = result.Items || [];
        const failedItems = items.filter(i => i.status === 'FAILED');
        const successItems = items.filter(i => i.status === 'SUCCESS');

        if (exportType === 'json') {
            writeLog("INFO", "Generando reporte JSON de errores", { batchId, failedCount: failedItems.length });
            const errorPayload = failedItems.map(item => ({
                email: item.email,
                category: item.category,
                amount: item.amount,
                errorMessage: item.errorMessage
            }));

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="correccion-${batchId}.json"`
                },
                body: JSON.stringify(errorPayload, null, 2)
            };
        }

        if (exportType === 'pdf') {
            writeLog("INFO", "Generando reporte PDF ejecutivo", { batchId, successCount: successItems.length, failedCount: failedItems.length });
            const pdfBuffer = await generatePdfBuffer(batchId, successItems, failedItems);
            const reportKey = `reports/reporte-${batchId}.pdf`;

            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: reportKey,
                Body: pdfBuffer,
                ContentType: 'application/pdf'
            }));

            const downloadUrl = await getSignedUrl(s3Client, new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: reportKey
            }), { expiresIn: 300 });

            writeLog("INFO", "PDF generado y subido a S3 con URL firmada", { batchId, reportKey });

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ downloadUrl })
            };
        }

        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Invalid export type. Use ?type=json or ?type=pdf" })
        };

    } catch (error) {
        writeLog("ERROR", "Error crítico generando reporte", {
            errorName: error.name || "Error",
            errorMessage: error.message,
            stackTrace: error.stack
        });
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Internal Server Error", details: error.message })
        };
    }
};

function generatePdfBuffer(batchId, successItems, failedItems) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        doc.fontSize(20).text(`Reporte de Procesamiento`, { align: 'center' });
        doc.fontSize(12).fillColor('gray').text(`Lote ID: ${batchId}`, { align: 'center' });
        doc.moveDown(2);

        doc.fillColor('black').fontSize(14).text('Resumen Ejecutivo');
        doc.fontSize(10).text(`- Registros Exitosos: ${successItems.length}`);
        doc.text(`- Registros con Fallos: ${failedItems.length}`);
        doc.moveDown(1.5);

        doc.fontSize(14).fillColor('red').text('Registros Fallidos (Errores a Corregir)');
        doc.moveDown(0.5);
        if (failedItems.length === 0) {
            doc.fontSize(10).fillColor('black').text('No se registraron fallos en este lote.');
        } else {
            failedItems.forEach((item, index) => {
                doc.fontSize(10).fillColor('black').text(`${index + 1}. Email: ${item.email} | Categoría: ${item.category}`);
                doc.fillColor('red').text(`   Motivo: ${item.errorMessage}`);
                doc.moveDown(0.3);
            });
        }
        doc.moveDown(1.5);

        doc.fontSize(14).fillColor('green').text('Registros Exitosos');
        doc.moveDown(0.5);
        if (successItems.length === 0) {
            doc.fontSize(10).fillColor('black').text('No hay registros exitosos.');
        } else {
            successItems.forEach((item, index) => {
                doc.fontSize(10).fillColor('black').text(`${index + 1}. Email: ${item.email} | Monto: $${item.amount} | Categoría: ${item.category}`);
                doc.moveDown(0.3);
            });
        }

        doc.end();
    });
}

