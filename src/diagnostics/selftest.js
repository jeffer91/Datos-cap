/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /src/diagnostics/selftest.js
Función o funciones:
- Ejecutar un diagnóstico rápido sin abrir Electron.
- Verificar ocho tipos documentales y ocho procesadores activos.
- Comprobar contratos, identificadores, exportadores y base local.
- Validar una exportación mínima a Excel y JSON.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ids = require("../utils/ids");
const normalizer = require("../extractor/normalizer");
const exporters = require("../exporters");
const { createPersistenceService } = require("../database");
const { listDocumentTypes, getDocumentType } = require("../core/document-type.registry");
const { assertProcessor, listProcessorIds, listProcessors } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function assertProcessorContract(processorId, expectedTableCount, requiresHybridReader) {
  const definition = getDocumentType(processorId);
  const processor = assertProcessor(processorId);
  assertCondition(Boolean(definition && definition.enabled), `El módulo ${processorId} no está activo.`);
  assertCondition(definition.tables.length === expectedTableCount, `El módulo ${processorId} no declara ${expectedTableCount} tablas.`);
  assertCondition(typeof processor.parseDocuments === "function", `El módulo ${processorId} no expone parseDocuments.`);
  assertCondition(typeof processor.buildTables === "function", `El módulo ${processorId} no expone buildTables.`);
  assertCondition(typeof processor.validateParseResult === "function", `El módulo ${processorId} no expone validateParseResult.`);
  assertCondition(typeof processor.validateTableResult === "function", `El módulo ${processorId} no expone validateTableResult.`);
  if (requiresHybridReader) assertCondition(typeof processor.readDocuments === "function", `El módulo ${processorId} no expone lector híbrido.`);
}

function runSelfTest() {
  const startedAt = new Date();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gestor-documental-test-"));
  const documentTypes = listDocumentTypes();
  const processorIds = listProcessorIds();
  const processorDetails = listProcessors();
  const expectedProcessors = [
    ["plan-individual", 5, false],
    ["planificacion-curso", 4, true],
    ["acuerdo-patrocinio", 4, true],
    ["informe-final", 6, true],
    ["instrumento-evaluacion", 8, true],
    ["informe-impacto", 7, true],
    ["deteccion-necesidades", 9, true],
    ["plan-general-capacitacion", 8, true]
  ];

  assertCondition(documentTypes.length === 8, "No están registrados los 8 tipos documentales.");
  assertCondition(processorIds.length === expectedProcessors.length, "La cantidad de procesadores activos no coincide con la etapa actual.");
  expectedProcessors.forEach(([processorId, tableCount, requiresHybridReader]) => {
    assertCondition(processorIds.includes(processorId), `El procesador ${processorId} no está registrado.`);
    assertProcessorContract(processorId, tableCount, requiresHybridReader);
  });

  assertCondition(typeof ids.createDocumentId === "function", "ids.createDocumentId no está disponible.");
  assertCondition(ids.extractRegistroFromCodigo("CGC-RGI2-146-PRO-134-2025-03") === "146", "No se reconoce el registro de códigos CGC.");
  assertCondition(ids.extractRegistroFromCodigo("UGPA-RGI2-01-PRO-70-2025-10") === "01", "No se reconoce el registro del Plan de Capacitación PRO-70.");
  assertCondition(normalizer.parseCodigoDocumento("UGPA-RGI2-01-PRO￾70-2025-10", "70") === "UGPA-RGI2-01-PRO-70-2025-10", "No se normaliza correctamente un código del Plan de Capacitación.");
  assertCondition(typeof exporters.exportAll === "function", "exporters.exportAll no está disponible.");

  const persistenceService = createPersistenceService(path.join(tempDir, "local-database"));
  const databaseSummary = persistenceService.getSummary();
  assertCondition(databaseSummary.ok, "La base local no pudo inicializarse.");
  assertCondition(databaseSummary.databaseVersion === 1, "La versión de la base local no es la esperada.");
  assertCondition(fs.existsSync(databaseSummary.databasePath), "No se creó la carpeta de la base local.");

  const exportResult = exporters.exportAll({
    outputDir: tempDir,
    baseName: "selftest_reporte_minimo",
    documentType: "diagnostico",
    documentLabel: "Diagnóstico",
    sheetOrder: ["diagnostico"],
    sheetLabels: { diagnostico: "01_diagnostico" },
    tables: { diagnostico: [{ estado: "OK", tipos_documentales: documentTypes.length, procesadores_activos: processorIds.length }] },
    summary: { total_tables: 1, total_rows: 1, estado_general: "OK" },
    validations: {}, warnings: [], errors: []
  });

  assertCondition(exportResult.ok, "La exportación mínima no devolvió ok=true.");
  assertCondition(fs.existsSync(exportResult.files.excel.filePath), "No se creó el Excel de diagnóstico.");
  assertCondition(fs.existsSync(exportResult.files.json.filePath), "No se creó el JSON de diagnóstico.");

  return {
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    tempDir,
    documentTypes: documentTypes.map((item) => item.id),
    processors: processorDetails,
    database: databaseSummary,
    files: exportResult.files
  };
}

if (require.main === module) {
  try {
    console.log("SELFTEST_OK");
    console.log(JSON.stringify(runSelfTest(), null, 2));
  } catch (error) {
    console.error("SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { assertProcessorContract, runSelfTest };
