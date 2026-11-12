
const assert = require('assert');
const { dividirEnChunks } = require('./index'); //  Importa directo del index.js

console.log('--- Iniciando test para splitter-lambda ---');

const mockRecords = [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
    { id: 6 }, { id: 7 }, { id: 8 }, { id: 9 }, { id: 10 },
    { id: 11 }, { id: 12 }
];

// Llamada a la función dentro del mismo archivo
const resultado = dividirEnChunks(mockRecords, 10, 'batch-test-01', 'users/123/archivo.json');

// Aserciones
assert.strictEqual(resultado.length, 2, 'Debería generar exactamente 2 chunks');
assert.strictEqual(resultado[0].chunkIndex, 1);
assert.strictEqual(resultado[0].totalRecordsInChunk, 10);
assert.strictEqual(resultado[1].chunkIndex, 2);
assert.strictEqual(resultado[1].totalRecordsInChunk, 2);

console.log('¡Tests del index.js pasaron con éxito! ');