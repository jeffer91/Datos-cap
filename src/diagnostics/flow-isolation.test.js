/* =========================================================
Nombre completo: flow-isolation.test.js
Ruta o ubicación: /src/diagnostics/flow-isolation.test.js
Función o funciones:
- Ejecutar los ocho procesadores secuencialmente sobre una misma base local.
- Verificar que cada flujo produzca y exporte únicamente sus tablas declaradas.
- Confirmar que ningún módulo sobrescriba documentos o filas de otro módulo.
- Comprobar consultas, deduplicación, respaldo y restauración integral.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const { listDocumentTypes } = require("../core/document-type.registry");
const { assertProcessor } = require("../core/processor.registry");
const { exportAll } = require("../exporters");
const {
  createPersistenceService,
  createQueryService,
  createBackupService,
  BACKUP_EXTENSION
} = require("../database");

const { createSyntheticPdfDocument } = require("./plan-individual.parser.test");
const { createSyntheticPlanningDocument } = require("./planificacion-curso.parser.test");
const { createSyntheticAgreementDocument } = require("./acuerdo-patrocinio.parser.test");
const { createSyntheticFinalReport } = require("./informe-final.parser.test");
const { createSyntheticEvaluationInstrument } = require("./instrumento-evaluacion.parser.test");
const { createSyntheticImpactReport } = require("./informe-impacto.parser.test");
const { createSyntheticNeedsDetection } = require("./deteccion-necesidades.parser.test");
const { createSyntheticGeneralPlan } = require("./plan-general-capacitacion.parser.test");

const FIXTURE_FACTORIES = Object.freeze({
  "plan-individual": createSyntheticPdfDocument,
  "planificacion-curso": createSyntheticPlanningDocument,
  "acuerdo-patrocinio": createSyntheticAgreementDocument,
  "informe-final": createSyntheticFinalReport,
  "instrumento-evaluacion": createSyntheticEvaluationInstrument,
  "informe-impacto": createSyntheticImpactReport,
  "deteccion-necesidades": createSyntheticNeedsDetection,
  "plan-general-capacitacion": createSyntheticGeneralPlan
});

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function createSheetLabels(definition) {
  return Object.fromEntries(definition.tables.map((table) => [table.name, table.sheet]));
}

function validateExport(definition, expectedTables, exportResult) {
  assertCondition(exportResult && exportResult.ok, `${definition.id}: la exportación no terminó correctamente.`);
  assertCondition(exportResult.documentType === definition.id, `${definition.id}: la exportación informó otro tipo documental.`);

  const excelPath = exportResult.files && exportResult.files.excel && exportResult.files.excel.filePath;
  const jsonPath = exportResult.files && exportResult.files.json && exportResult.files.json.filePath;
  assertCondition(excelPath && fs.existsSync(excelPath), `${definition.id}: no se creó el archivo Excel.`);
  assertCondition(jsonPath && fs.existsSync(jsonPath), `${definition.id}: no se creó el archivo JSON.`);
  assertCondition(fs.statSync(excelPath).size > 0, `${definition.id}: el Excel quedó vacío.`);
  assertCondition(fs.statSync(jsonPath).size > 0, `${definition.id}: el JSON quedó vacío.`);

  const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  assertCondition(payload.metadata.tipo_documental === definition.id, `${definition.id}: el JSON contiene otro tipo documental.`);
  assertCondition(payload.metadata.nombre_tipo_documental === definition.label, `${definition.id}: el JSON contiene otro nombre documental.`);
  assertCondition(sameValues(Object.keys(payload.tablas || {}), expectedTables), `${definition.id}: el JSON perdió o agregó tablas.`);
  expectedTables.forEach((tableName) => {
    assertCondition(Array.isArray(payload.tablas[tableName]), `${definition.id}: ${tableName} no es un arreglo en el JSON.`);
    assertCondition(payload.tablas[tableName].length > 0, `${definition.id}: ${tableName} quedó vacía en el JSON.`);
  });

  return {
    excelPath,
    jsonPath,
    excelSize: fs.statSync(excelPath).size,
    jsonSize: fs.statSync(jsonPath).size
  };
}

function executeModule(definition, persistence, outputDirectory) {
  const factory = FIXTURE_FACTORIES[definition.id];
  assertCondition(typeof factory === "function", `No existe fixture para ${definition.id}.`);

  const processor = assertProcessor(definition.processorId);
  const sourceDocument = factory();
  const parseResult = processor.parseDocuments([sourceDocument]);
  assertCondition(parseResult.parsedCount === 1, `${definition.id}: no produjo exactamente un documento.`);
  assertCondition(parseResult.errorCount === 0, `${definition.id}: produjo errores de parseo.`);

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.ok, `${definition.id}: la validación del documento falló.`);

  const tableResult = processor.buildTables(parseResult);
  const tableValidation = processor.validateTableResult(tableResult);
  assertCondition(tableValidation.ok, `${definition.id}: la estructura de tablas falló.`);

  const expectedTables = definition.tables.map((table) => table.name);
  const actualTables = Object.keys(tableResult.tables || {});
  assertCondition(
    sameValues(expectedTables, actualTables),
    `${definition.id}: las tablas generadas no coinciden con la definición. Esperadas: ${expectedTables.join(", ")}. Reales: ${actualTables.join(", ")}.`
  );

  expectedTables.forEach((tableName) => {
    assertCondition(Array.isArray(tableResult.tables[tableName]), `${definition.id}: ${tableName} no es un arreglo.`);
    assertCondition(tableResult.tables[tableName].length > 0, `${definition.id}: ${tableName} quedó vacía.`);
    tableResult.tables[tableName].forEach((row) => {
      assertCondition(row.id, `${definition.id}/${tableName}: existe una fila sin id.`);
      assertCondition(row.id_documento, `${definition.id}/${tableName}: existe una fila sin id_documento.`);
    });
  });

  const moduleOutputDirectory = path.join(outputDirectory, definition.id);
  fs.mkdirSync(moduleOutputDirectory, { recursive: true });
  const exportResult = exportAll({
    outputDir: moduleOutputDirectory,
    baseName: `verificacion_${definition.id}`,
    documentType: definition.id,
    documentLabel: definition.label,
    sheetOrder: expectedTables,
    sheetLabels: createSheetLabels(definition),
    tables: tableResult.tables,
    summary: tableResult.summary || {},
    validations: tableResult.validations || {},
    warnings: [],
    errors: []
  });
  const exportedFiles = validateExport(definition, expectedTables, exportResult);

  const persistenceResult = persistence.persistProcessingResult({
    definition,
    documentType: definition.id,
    processorId: processor.id,
    outputDir: moduleOutputDirectory,
    parseResult,
    tableResult
  });
  assertCondition(persistenceResult.ok, `${definition.id}: no pudo persistirse.`);
  assertCondition(persistenceResult.documentsSaved === 1, `${definition.id}: debía guardar un documento nuevo.`);
  assertCondition(persistenceResult.rowsSaved > 0, `${definition.id}: no guardó filas.`);

  persistence.finalizeProcessingRun(persistenceResult.runId, {
    ok: true,
    outputDir: moduleOutputDirectory,
    files: exportResult.files
  });

  return {
    definition,
    processor,
    sourceDocument,
    parseResult,
    tableResult,
    exportResult,
    exportedFiles,
    persistenceResult
  };
}

function verifyQueries(definitions, query) {
  definitions.forEach((definition) => {
    const result = query.queryDocuments({ documentType: definition.id, pageSize: 100 });
    assertCondition(result.ok, `${definition.id}: la consulta falló.`);
    assertCondition(result.pagination.total === 1, `${definition.id}: la consulta debía devolver un documento.`);
    assertCondition(result.items[0].tipo_documental === definition.id, `${definition.id}: la consulta devolvió otro tipo.`);

    const detail = query.getDocumentDetail(result.items[0].id_documento, { rowLimit: 500 });
    assertCondition(detail.ok, `${definition.id}: no se recuperó el detalle documental.`);
    const detailCollections = Object.keys(detail.collections || detail.colecciones || {});
    assertCondition(
      sameValues(detailCollections, definition.tables.map((table) => table.name)),
      `${definition.id}: el detalle no contiene exactamente sus colecciones.`
    );
  });
}

function verifyBackupAndRestore(tempDirectory, persistence, definitions, expectedSummary) {
  const backupDirectory = path.join(tempDirectory, "backups-origin");
  const backupPath = path.join(tempDirectory, `verificacion-integral${BACKUP_EXTENSION}`);
  const backupService = createBackupService(persistence.database, {
    appVersion: "2.2.1-final-verification",
    backupDirectory,
    defaultRetention: 3
  });

  const backup = backupService.createBackup(backupPath, { reason: "verificacion-integral" });
  assertCondition(backup.ok, "No se pudo crear el respaldo integral.");
  assertCondition(fs.existsSync(backup.filePath), "El respaldo integral no existe físicamente.");
  const validation = backupService.validateBackup(backup.filePath);
  assertCondition(validation.ok, "El respaldo integral no superó su propia validación.");
  assertCondition(validation.summary.recordCount === expectedSummary.totalRecords, "El respaldo integral perdió registros.");

  const restoredPersistence = createPersistenceService(path.join(tempDirectory, "database-restored"));
  const restoredBackupService = createBackupService(restoredPersistence.database, {
    appVersion: "2.2.1-final-verification",
    backupDirectory: path.join(tempDirectory, "backups-restored"),
    defaultRetention: 3
  });
  const restored = restoredBackupService.restoreBackup(backup.filePath, { mode: "replace" });
  assertCondition(restored.ok, "La restauración integral falló.");

  const restoredSummary = restoredPersistence.getSummary();
  assertCondition(restoredSummary.documentCount === expectedSummary.documentCount, "La restauración cambió el total de documentos.");
  assertCondition(restoredSummary.activeDocumentCount === expectedSummary.activeDocumentCount, "La restauración cambió los documentos activos.");
  assertCondition(restoredSummary.tableRows === expectedSummary.tableRows, "La restauración cambió el total de filas.");
  assertCondition(restoredSummary.processingRunCount === expectedSummary.processingRunCount, "La restauración cambió el historial.");

  const restoredQuery = createQueryService(restoredPersistence.database);
  verifyQueries(definitions, restoredQuery);

  return {
    backup,
    validation: validation.summary,
    restoredSummary
  };
}

function runFlowIsolationTest() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-flow-isolation-"));
  const databaseDirectory = path.join(tempDirectory, "database");
  const outputDirectory = path.join(tempDirectory, "exports");
  fs.mkdirSync(outputDirectory, { recursive: true });

  const persistence = createPersistenceService(databaseDirectory);
  const query = createQueryService(persistence.database);
  const definitions = listDocumentTypes();
  const executions = definitions.map((definition) => executeModule(definition, persistence, outputDirectory));

  const expectedCollectionNames = sorted(definitions.flatMap((definition) => definition.tables.map((table) => table.name)));
  const actualCollectionNames = sorted(persistence.database.listCollections().filter((name) => !name.startsWith("_")));
  assertCondition(
    sameValues(expectedCollectionNames, actualCollectionNames),
    "Las colecciones persistidas no coinciden con la suma de las tablas declaradas."
  );

  const exportPaths = executions.flatMap((execution) => [
    execution.exportedFiles.excelPath,
    execution.exportedFiles.jsonPath
  ]);
  assertCondition(exportPaths.length === 16, "No se generaron los 16 archivos esperados para los ocho módulos.");
  assertCondition(new Set(exportPaths).size === exportPaths.length, "Dos módulos utilizaron la misma ruta de exportación.");

  const collectionOwners = new Map();
  executions.forEach((execution) => {
    const documentId = execution.parseResult.parsed[0].id_documento;
    execution.definition.tables.forEach((table) => {
      const rows = persistence.database.readCollection(table.name);
      assertCondition(rows.length > 0, `${table.name}: no tiene registros después de la persistencia.`);
      assertCondition(
        rows.every((row) => row.id_documento === documentId),
        `${table.name}: contiene filas pertenecientes a otro flujo documental.`
      );
      collectionOwners.set(table.name, execution.definition.id);
    });
  });

  verifyQueries(definitions, query);

  const summaryBeforeDuplicate = persistence.getSummary();
  assertCondition(summaryBeforeDuplicate.documentCount === 8, "La base debía contener ocho documentos.");
  assertCondition(summaryBeforeDuplicate.activeDocumentCount === 8, "Los ocho documentos debían estar activos.");
  assertCondition(summaryBeforeDuplicate.processingRunCount === 8, "Debían existir ocho ejecuciones completas.");

  const first = executions[0];
  const duplicatePersistence = persistence.persistProcessingResult({
    definition: first.definition,
    documentType: first.definition.id,
    processorId: first.processor.id,
    outputDir: outputDirectory,
    parseResult: first.parseResult,
    tableResult: first.tableResult
  });
  persistence.finalizeProcessingRun(duplicatePersistence.runId, {
    ok: true,
    outputDir: outputDirectory,
    files: first.exportResult.files
  });

  assertCondition(duplicatePersistence.documentsSaved === 0, "El reprocesamiento idéntico duplicó el documento.");
  assertCondition(duplicatePersistence.duplicateDocumentsSkipped === 1, "No se informó el duplicado reprocesado.");
  assertCondition(duplicatePersistence.rowsSaved === 0, "El reprocesamiento idéntico duplicó filas.");

  const finalSummary = persistence.getSummary();
  assertCondition(finalSummary.documentCount === 8, "El duplicado alteró el total de documentos.");
  assertCondition(finalSummary.tableRows === summaryBeforeDuplicate.tableRows, "El duplicado alteró el total de filas.");
  assertCondition(finalSummary.processingRunCount === 9, "El reprocesamiento no quedó registrado en el historial.");

  const backupVerification = verifyBackupAndRestore(tempDirectory, persistence, definitions, finalSummary);

  return {
    ok: true,
    tempDirectory,
    documentTypes: definitions.length,
    processorsExecuted: executions.length,
    collections: actualCollectionNames.length,
    exportsGenerated: exportPaths.length,
    collectionOwners: Object.fromEntries(collectionOwners),
    summaryBeforeDuplicate,
    finalSummary,
    backupVerification
  };
}

if (require.main === module) {
  try {
    console.log("FLOW_ISOLATION_OK");
    console.log(JSON.stringify(runFlowIsolationTest(), null, 2));
  } catch (error) {
    console.error("FLOW_ISOLATION_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  FIXTURE_FACTORIES,
  createSheetLabels,
  validateExport,
  executeModule,
  verifyQueries,
  verifyBackupAndRestore,
  runFlowIsolationTest
};
