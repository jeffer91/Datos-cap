/* =========================================================
Nombre completo: seguimiento-capacitacion.processor.js
Ruta o ubicación: /src/processors/seguimiento-capacitacion.processor.js
Función o funciones:
- Procesar Instrumentos de Evaluación e Informes de Impacto digitales, escaneados o mixtos.
- Guardar los resultados en la base local y exportarlos a Excel y JSON.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFilesHybrid } = require("../readers/pdf-hybrid.reader");
const { exportAll } = require("../exporters");
const evaluationInstruments = require("../document-types/instrumento-evaluacion");
const impactReports = require("../document-types/informe-impacto");

function ensureOutputDirectory(outputDir) {
  const clean = String(outputDir || "").trim();
  if (!clean) throw new Error("Debes seleccionar una carpeta de salida.");
  if (!fs.existsSync(clean)) fs.mkdirSync(clean, { recursive: true });
  if (!fs.statSync(clean).isDirectory()) throw new Error("La salida seleccionada no es una carpeta válida.");
  return clean;
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getValidPaths(validation) {
  return (validation?.validFiles || []).filter((file) => file.valid && file.path).map((file) => file.path);
}

function getDefinition(documentType) {
  if (documentType === "instrumento-evaluacion") return evaluationInstruments;
  if (documentType === "informe-impacto") return impactReports;
  throw new Error(`Tipo de seguimiento no permitido: ${documentType || "vacío"}.`);
}

async function processTrackingReport(options = {}, documentType) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const paths = getValidPaths(options.validation);
  const moduleDefinition = getDefinition(documentType);
  const label = moduleDefinition.definition.label;
  if (!paths.length) return { ok: false, message: `No hay ${label} válidos para procesar.`, files: {}, summary: {} };

  const readResult = await readPdfFilesHybrid(paths, {
    onDocumentStart: options.onDocumentStart,
    onModeChange: options.onModeChange,
    onProgress: options.onOcrProgress,
    onPageStart: options.onPageStart,
    onPageRender: options.onPageRender,
    ocr: { maxPages: 150, scale: 2.2 }
  });
  const parseResult = moduleDefinition.parser.parseDocuments(readResult.documents);
  const documentValidations = parseResult.parsed.map((document) => moduleDefinition.validator.validateParsedDocument(document));
  const tableResult = moduleDefinition.tables.buildTables(parseResult);
  const warnings = [
    ...moduleDefinition.tables.flattenWarnings(tableResult.validations),
    ...documentValidations.flatMap((validation) => validation.warnings.map((advertencia) => ({
      id_documento: validation.documentId,
      advertencia
    })))
  ];

  const persistence = options.persistenceService
    ? options.persistenceService.persistProcessingResult({
      documentType,
      parsedDocuments: parseResult.parsed,
      tables: tableResult.tables,
      outputDir,
      summary: tableResult.summary
    })
    : null;

  let exportResult;
  try {
    exportResult = exportAll({
      outputDir,
      baseName: `${moduleDefinition.definition.reportPrefix}_${timestamp()}`,
      tables: tableResult.tables,
      summary: tableResult.summary,
      validations: tableResult.validations,
      warnings,
      errors: parseResult.errors
    });
    if (persistence && options.persistenceService) {
      options.persistenceService.completeRun(persistence.runId, { ok: true, files: exportResult.files });
    }
  } catch (error) {
    if (persistence && options.persistenceService) {
      options.persistenceService.completeRun(persistence.runId, { ok: false, message: error.message });
    }
    throw error;
  }

  return {
    ok: true,
    message: `${label} procesados correctamente.`,
    outputDir,
    files: exportResult.files,
    summary: tableResult.summary,
    validation: options.validation,
    readResult: {
      total: readResult.total,
      okCount: readResult.okCount,
      errorCount: readResult.errorCount,
      digitalCount: readResult.digitalCount,
      ocrCount: readResult.ocrCount,
      mixedCount: readResult.mixedCount
    },
    parseResult: {
      total: parseResult.total,
      parsedCount: parseResult.parsedCount,
      errorCount: parseResult.errorCount
    },
    persistence,
    warnings,
    errors: parseResult.errors
  };
}

function processEvaluationInstrumentReport(options = {}) {
  return processTrackingReport(options, "instrumento-evaluacion");
}

function processImpactReport(options = {}) {
  return processTrackingReport(options, "informe-impacto");
}

module.exports = {
  ensureOutputDirectory,
  timestamp,
  getValidPaths,
  getDefinition,
  processTrackingReport,
  processEvaluationInstrumentReport,
  processImpactReport
};
