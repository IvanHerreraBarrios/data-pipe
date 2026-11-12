const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const SERVICE_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || "datapipe-worker-lab";

const writeLog = (level, message, data = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: level,
        service: SERVICE_NAME,
        message: message,
        ...data
    }));
};

const emitMetric = (metricName, value, dimensions = {}) => {
    const emfLog = {
        _aws: {
            Timestamp: Date.now(),
            CloudWatchMetrics: [
                {
                    Namespace: "DataPipeline/BusinessMetrics",
                    Dimensions: [Object.keys(dimensions)],
                    Metrics: [{ Name: metricName, Unit: "Count" }]
                }
            ]
        },
        ...dimensions,
        [metricName]: value,
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: `Métrica de negocio registrada: ${metricName} = ${value}`
    };
    console.log(JSON.stringify(emfLog));
};

const isValidEmail = (email) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email);
};

exports.handler = async (event) => {
    writeLog("INFO", "Iniciando procesamiento de registros desde SQS", { recordsCount: event.Records.length });

    try {
        for (const sqsRecord of event.Records) {
            const body = JSON.parse(sqsRecord.body);
            const { batchId, chunkIndex, chunkRecords, sourceKey, totalRecordsInFile } = body;

            const userId = sourceKey ? sourceKey.split('/')[1] : "unknown_user";

            let successCount = 0;
            let failureCount = 0;
            const putRequests = [];

            // Procesamos el bloque calculando el índice global absoluto
            chunkRecords.forEach((record, localIndex) => {
                // Fórmula correcta y limpia:
                const globalIndex = ((chunkIndex || 1) - 1) * 10 + localIndex;

                const email = record.email || "";
                const isEmailValid = isValidEmail(email);

                const status = isEmailValid ? "SUCCESS" : "FAILED";
                const errorMessage = isEmailValid ? null : "Formato de correo electrónico inválido";

                if (isEmailValid) successCount++;
                else failureCount++;

                putRequests.push({
                    PutRequest: {
                        Item: {
                            PK: `BATCH#${batchId}`,
                            SK: `RECORD#${globalIndex}`, // Clave única garantizada (RECORD#0 hasta RECORD#N)
                            email: email,
                            category: record.category || "N/A",
                            amount: record.amount || 0,
                            status: status,
                            errorMessage: errorMessage,
                            processedAt: new Date().toISOString()
                        }
                    }
                });
            });

            // Escribir filas en lote en DynamoDB
            if (putRequests.length > 0) {
                await docClient.send(new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: putRequests
                    }
                }));
            }

            // Actualizar contadores globales en DynamoDB
            const updateResult = await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: `BATCH#${batchId}`
                },
                UpdateExpression: "ADD totalSuccess :incSuccess, totalFailed :incFail SET updatedAt = :now, totalExpected = :expected",
                ExpressionAttributeValues: {
                    ":incSuccess": successCount,
                    ":incFail": failureCount,
                    ":now": new Date().toISOString(),
                    ":expected": totalRecordsInFile || 0
                },
                ReturnValues: "ALL_NEW"
            }));

            const updatedItem = updateResult.Attributes;
            const currentTotalProcessed = (updatedItem.totalSuccess || 0) + (updatedItem.totalFailed || 0);
            const expectedTotal = totalRecordsInFile || currentTotalProcessed;
            const statusVal = currentTotalProcessed >= expectedTotal ? "COMPLETED" : "PROCESSING";

            // Actualizar estado final del lote
            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: `BATCH#${batchId}`
                },
                UpdateExpression: "SET #st = :statusVal",
                ExpressionAttributeNames: {
                    "#st": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": statusVal
                }
            }));

            writeLog("INFO", "Bloque de lote procesado correctamente", {
                batchId: batchId,
                chunkIndex: chunkIndex,
                userId: userId,
                processedCount: currentTotalProcessed,
                expectedTotal: expectedTotal,
                status: statusVal
            });

            if (failureCount > 0) {
                emitMetric("InvalidEmailCount", failureCount, {
                    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME || "datapipe-worker-lab"
                });
            }
        }

        return { statusCode: 200, body: "Worker processed successfully" };
    } catch (error) {
        writeLog("ERROR", "Error crítico ejecutando el Worker Lambda", {
            errorName: error.name || "Error",
            errorMessage: error.message,
            stackTrace: error.stack
        });
        throw error;
    }
};