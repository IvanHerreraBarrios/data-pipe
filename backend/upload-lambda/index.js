const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb"); // <--- Importamos DynamoDB
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const s3 = new S3Client({
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
});

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME; // <--- Asegúrate de pasar esta variable de entorno en Terraform
const SERVICE_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || "datapipe-upload";

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
    writeLog("INFO", "Iniciando solicitud de presigned URL con validación de batchId");

    try {
        const claims = event.requestContext?.authorizer?.jwt?.claims || event.requestContext?.authorizer?.claims || {};
        const userId = claims.sub || "anonymous-user";

        const body = JSON.parse(event.body || "{}");
        const fileName = body.fileName || `data-${Date.now()}.json`;
        const batchId = body.batchId; // <--- Recibimos el batchId desde el cliente

        //  Validar que nos pasen el batchId
        if (!batchId) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "El campo batchId es obligatorio." })
            };
        }

        //  Verificar en DynamoDB si este batchId ya existe para el usuario
        const existingBatch = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: `BATCH#${batchId}`
            }
        }));

        if (existingBatch.Item) {
            writeLog("WARN", "Intento de usar un batchId ya existente", { userId, batchId });
            return {
                statusCode: 409, // 409 Conflict
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: `El batchId '${batchId}' ya fue registrado anteriormente. No se puede reutilizar.` })
            };
        }

        const key = `users/${userId}/uploads/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            ContentType: "application/json"
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

        writeLog("INFO", "Presigned URL generada con éxito y batchId disponible", { userId, key, batchId });

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Headers": "authorization,content-type"
            },
            body: JSON.stringify({ uploadUrl, key })
        };
    } catch (error) {
        writeLog("ERROR", "Error generando presigned URL", {
            errorName: error.name || "Error",
            errorMessage: error.message,
            stackTrace: error.stack
        });
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};


