const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const s3 = new S3Client({});

const BUCKET_NAME = process.env.BUCKET_NAME;

// Función estándar de logging estructurado para CloudWatch Insights
const writeLog = (level, message, metadata = {}) => {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        ...metadata
    }));
};

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const clientHash = body.fileHash;
        const userId = body.userId;

        if (!clientHash || !userId) {
            writeLog("WARN", "Parámetros incompletos en la validación de duplicados", { userId });
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Faltan parámetros (fileHash o userId)" })
            };
        }

        const prefix = `users/${userId}/uploads/`;
        writeLog("INFO", "Consultando S3 para verificar ETag duplicado", { bucket: BUCKET_NAME, prefix });

        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            MaxKeys: 50
        });

        const s3Response = await s3.send(listCommand);
        const contents = s3Response.Contents || [];

        const cleanClientHash = clientHash.replace(/"/g, "").toLowerCase();

        const found = contents.find(item => {
            const itemETag = (item.ETag || "").replace(/"/g, "").toLowerCase();
            return itemETag === cleanClientHash;
        });

        if (found) {
            writeLog("WARN", "Archivo duplicado detectado por ETag", { userId, matchedKey: found.Key, fileHash: cleanClientHash });
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({
                    exists: true,
                    message: "Este archivo ya existe en el sistema."
                })
            };
        }

        writeLog("INFO", "Archivo validado como único exitosamente", { userId, fileHash: cleanClientHash });
        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                exists: false,
                message: "Archivo único, permitido."
            })
        };

    } catch (error) {
        writeLog("ERROR", "Error interno al validar duplicados", { error: error.message, stack: error.stack });
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Error interno del servidor", error: error.message })
        };
    }
};