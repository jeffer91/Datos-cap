/* =========================================================
Nombre completo: flow-isolation.test.js
Ruta o ubicación: /src/diagnostics/flow-isolation.test.js
Función o funciones:
- Ejecutar los ocho procesadores de manera secuencial sobre una misma base local.
- Verificar que cada flujo produzca únicamente sus tablas declaradas.
- Confirmar que ningún módulo sobrescriba documentos o filas de otro módulo.
- Comprobar consultas por tipo y deduplicación después del flujo completo.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const { listDocumentTypes } = require("../core/document-type.registry");
const { assertProcessor } = require("../core/processor.registry");
const { createPersistenceService, createQueryService } = require("../database");

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

  const persistenceResult = persistence.persistProcessingResult({
    definition,
    documentType: definition.id,
    processorId: processor.id,
    outputDir: outputDirectory,
    parseResult,
    tableResult
  });
  assertCondition(persistenceResult.ok, `${definition.id}: no pudo persistirse.`);
  assertCondition(persistenceResult.documentsSaved === 1, `${definition.id}: debía guardar un documento nuevo.`);
  assertCondition(persistenceResult.rowsSaved > 0, `${definition.id}: no guardó filas.`);

  persistence.finalizeProcessingRun(persistenceResult.runId, {
    ok: true,
    outputDir: outputDirectory,
    files: {}
  });

  return {
    definition,
    processor,
    sourceDocument,
    parseResult,
    tableResult,
    persistenceResult
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

  definitions.forEach((definition) => {
    const result = query.queryDocuments({ documentType: definition.id, pageSize: 100 });
    assertCondition(result.ok, `${definition.id}: la consulta falló.`);
    assertCondition(result.pagination.total === 1, `${definition.id}: la consulta debía devolver un documento.`);
    assertCondition(result.items[0].tipo_documental === definition.id, `${definition.id}: la consulta devolvió otro tipo.`);
  });

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
    files: {}
  });

  assertCondition(duplicatePersistence.documentsSaved === 0, "El reprocesamiento idéntico duplicó el documento.");
  assertCondition(duplicatePersistence.duplicateDocumentsSkipped === 1, "No se informó el duplicado reprocesado.");
  assertCondition(duplicatePersistence.rowsSaved === 0, "El reprocesamiento idéntico duplicó filas.");

  const finalSummary = persistence.getSummary();
  assertCondition(finalSummary.documentCount === 8, "El duplicado alteró el total de documentos.");
  assertCondition(finalSummary.tableRows === summaryBeforeDuplicate.tableRows, "El duplicado alteró el total de filas.");
  assertCondition(finalSummary.processingRunCount === 9, "El reprocesamiento no quedó registrado en el historial.");

  return {
    ok: true,
    tempDirectory,
    documentTypes: definitions.length,
    processorsExecuted: executions.length,
    collections: actualCollectionNames.length,
    collectionOwners: Object.fromEntries(collectionOwners),
    summaryBeforeDuplicate,
    finalSummary
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
  executeModule,
  runFlowIsolationTest
};
