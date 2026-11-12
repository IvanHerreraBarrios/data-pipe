const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

const s3 = new S3Client();
const sqs = new SQSClient();

const WORKERS_QUEUE_URL = process.env.WORKERS_QUEUE_URL;
const SERVICE_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || "datapipe-splitter";

const writeLog = (level, message, data = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: level,
        service: SERVICE_NAME,
        message: message,
        ...data
    }));
};

function dividirEnChunks(records, batchSize = 10, batchId = "unknown", key = "") {
    if (!Array.isArray(records)) return [];

    const chunks = [];
    let chunkCounter = 0;

    for (let i = 0; i < records.length; i += batchSize) {
        const chunk = records.slice(i, i + batchSize);
        chunkCounter++;

        chunks.push({
            batchId: batchId,
            chunkIndex: chunkCounter, //enviar 1, 2 etc y que el worker sepa por donde ocntar
            totalRecordsInChunk: chunk.length,
            totalRecordsInFile: records.length,
            chunkRecords: chunk,
            sourceKey: key
        });
    }

    return chunks;
}

exports.handler = async (event) => {
    writeLog("INFO", "Iniciando división de archivo desde S3", { recordsCount: event.Records.length });

    try {
        for (const sqsRecord of event.Records) {
            const s3Event = JSON.parse(sqsRecord.body);

            for (const record of s3Event.Records || []) {
                const bucket = record.s3.bucket.name;
                const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

                writeLog("INFO", "Descargando archivo desde S3", { bucket, key });

                const getObjectResult = await s3.send(new GetObjectCommand({
                    Bucket: bucket,
                    Key: key
                }));

                const streamToString = async (stream) => {
                    let chunks = [];
                    for await (let chunk of stream) {
                        chunks.push(chunk);
                    }
                    return Buffer.concat(chunks).toString("utf-8");
                };

                const fileContent = await streamToString(getObjectResult.Body);
                const data = JSON.parse(fileContent);

                const records = data.records || [];
                const totalRecordsInFile = records.length;

                writeLog("INFO", "Archivo analizado correctamente", { totalRecordsInFile, batchId: data.batchId });

                const chunksList = dividirEnChunks(records, 10, data.batchId || "unknown", key);

                for (const chunkPayload of chunksList) {
                    await sqs.send(new SendMessageCommand({
                        QueueUrl: WORKERS_QUEUE_URL,
                        MessageBody: JSON.stringify(chunkPayload)
                    }));
                }

                writeLog("INFO", "Todos los bloques enviados a SQS", { totalChunks: chunksList.length, batchId: data.batchId });
            }
        }
        return { statusCode: 200, body: "Split in batches of 10 successful" };
    } catch (error) {
        writeLog("ERROR", "Error crítico en Lambda Splitter", {
            errorName: error.name || "Error",
            errorMessage: error.message,
            stackTrace: error.stack
        });
        throw error;
    }
};

exports.dividirEnChunks = dividirEnChunks;

