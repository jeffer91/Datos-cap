/* =========================================================
Nombre completo: firebase-sync.selftest.js
Ruta o ubicación: /src/diagnostics/firebase-sync.selftest.js
Función o funciones:
- Comprobar hashes estables para detectar cambios reales.
- Comprobar división de colecciones grandes en bloques.
- Comprobar que el dato local prevalece durante una conciliación.
- Comprobar cálculo de la próxima sincronización diaria.
========================================================= */
"use strict";

const assert = require("assert");
const {
  hashRecords,
  collectionDocumentId,
  splitRecordsIntoChunks,
  mergeRemoteWithLocal,
  maskEmail,
  nextDailyDelay
} = require("../firebase/firebase-sync.service");

function run() {
  const left = [{ id: "1", name: "Jeff", meta: { b: 2, a: 1 } }];
  const right = [{ meta: { a: 1, b: 2 }, name: "Jeff", id: "1" }];
  assert.strictEqual(hashRecords(left), hashRecords(right));
  assert.strictEqual(collectionDocumentId("_documents").length, 40);

  const rows = Array.from({ length: 25 }, (_value, index) => ({
    id: String(index + 1),
    content: "x".repeat(120)
  }));
  const chunks = splitRecordsIntoChunks(rows, { maxBytes: 900, maxRecords: 8 });
  assert.ok(chunks.length > 1);
  assert.strictEqual(chunks.flat().length, rows.length);
  assert.ok(chunks.every((chunk) => chunk.length <= 8));

  const merged = mergeRemoteWithLocal(
    [{ id: "1", value: "remoto" }, { id: "2", value: "solo remoto" }],
    [{ id: "1", value: "local" }, { id: "3", value: "solo local" }]
  );
  assert.strictEqual(merged.find((row) => row.id === "1").value, "local");
  assert.strictEqual(merged.length, 3);
  assert.strictEqual(maskEmail("jeff@example.com"), "je••@example.com");

  const morning = new Date("2026-08-04T08:00:00-05:00");
  const evening = new Date("2026-08-04T20:00:00-05:00");
  assert.strictEqual(nextDailyDelay(morning, 19), 11 * 60 * 60 * 1000);
  assert.strictEqual(nextDailyDelay(evening, 19), 23 * 60 * 60 * 1000);

  console.log("Firebase local-first: pruebas correctas.");
}

if (require.main === module) {
  try { run(); }
  catch (error) {
    console.error("FIREBASE_SYNC_SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { run };
