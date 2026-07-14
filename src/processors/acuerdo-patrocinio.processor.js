/* =========================================================
Nombre completo: acuerdo-patrocinio.processor.js
Ruta o ubicación: /src/processors/acuerdo-patrocinio.processor.js
Función o funciones:
- Procesar Acuerdos de Patrocinio digitales, escaneados o mixtos.
- Guardar resultados en la base local y exportar Excel/JSON.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFilesHybrid } = require("../readers/pdf-hybrid.reader");
const { exportAll } = require("../exporters");
const agreement = require("../document-types/acuerdo-patrocinio");

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
function validPaths(validation) {
  return (validation?.validFiles || []).filter((file) => file.valid && file.path).map((file) => file.path);
}

async function processAgreementReport(options = {}) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const paths = validPaths(options.validation);
  if (!paths.length) return { ok: false, message: "No hay acuerdos válidos para procesar.", files: {}, summary: {} };

  const readResult = await readPdfFilesHybrid(paths, {
    onDocumentStart: options.onDocumentStart,
    onModeChange: options.onModeChange,
    onProgress: options.onOcrProgress,
    onPageStart: options.onPageStart,
    onPageRender: options.onPageRender,
    ocr: { maxPages: 30, scale: 2.2 }
  });
  const parseResult = agreement.parser.parseDocuments(readResult.documents);
  const tableResult = agreement.tables.buildTables(parseResult);
  const warnings = agreement.tables.flattenWarnings(tableResult.validations);
  const persistence = options.persistenceService
    ? options.persistenceService.persistProcessingResult({
      documentType: "acuerdo-patrocinio",
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
      baseName: `reporte_acuerdos_patrocinio_${timestamp()}`,
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
    message: "Acuerdos procesados correctamente.",
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

module.exports = {
  ensureOutputDirectory,
  timestamp,
  validPaths,
  processAgreementReport
};
