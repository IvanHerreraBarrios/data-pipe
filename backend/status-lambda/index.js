const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const SERVICE_NAME = process.env.AWS_LAMBDA_FUNCTION_NAME || "datapipe-status";

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
    writeLog("INFO", "Solicitud de estado de lotes recibida");

    try {
        const claims = event.requestContext?.authorizer?.jwt?.claims || {};
        const userId = claims.sub;

        if (!userId) {
            writeLog("WARN", "Intento de acceso sin identidad de usuario");
            return {
                statusCode: 401,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Unauthorized: Missing user identity" })
            };
        }

        const pkVal = `USER#${userId}`;

        const result = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pkVal",
            ExpressionAttributeValues: {
                ":pkVal": pkVal
            },
            ScanIndexForward: false
        }));

        const batches = (result.Items || []).filter(item => item.SK && item.SK.startsWith("BATCH#"));

        writeLog("INFO", "Lotes consultados exitosamente", { userId, totalBatches: batches.length });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batches)
        };

    } catch (error) {
        writeLog("ERROR", "Error crítico consultando estados en DynamoDB", {
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

