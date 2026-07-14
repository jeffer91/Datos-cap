/* =========================================================
Nombre completo: report.processor.js
Ruta o ubicación: /src/processors/report.processor.js
Función o funciones:
- Procesar Planes Individuales de principio a fin.
- Guardar las tablas en la base local antes de exportar Excel y JSON.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFiles } = require("../extractor/pdf.reader");
const { parsePdfDocuments } = require("../extractor/fields.parser");
const { buildAllTables, flattenValidationWarnings } = require("../tables");
const { exportAll } = require("../exporters");

function ensureOutputDirectory(outputDir) {
  const clean = String(outputDir || "").trim();
  if (!clean) throw new Error("Debes seleccionar una carpeta de salida.");
  if (!fs.existsSync(clean)) fs.mkdirSync(clean, { recursive: true });
  if (!fs.statSync(clean).isDirectory()) throw new Error("La salida seleccionada no es una carpeta válida.");
  return clean;
}
function createTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
function createReportBaseName() { return `reporte_plan_individual_${createTimestamp()}`; }
function normalizeValidFiles(files) {
  return (Array.isArray(files) ? files : []).filter((file) => file && file.valid && file.path).map((file) => file.path);
}

async function processReport(options = {}) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const validation = options.validation;
  if (!validation?.canContinue) return { ok: false, message: "No hay PDF válidos para procesar.", files: {}, summary: {} };
  const paths = normalizeValidFiles(validation.validFiles);
  if (!paths.length) return { ok: false, message: "La validación no contiene rutas PDF válidas.", files: {}, summary: {} };

  const readResult = await readPdfFiles(paths);
  const parseResult = parsePdfDocuments(readResult.documents);
  const tableResult = buildAllTables(parseResult);
  const warnings = flattenValidationWarnings(tableResult.validations);
  const errors = [
    ...(validation.invalidFiles || []).map((file) => ({ archivo: file.name, errores: file.errors || [] })),
    ...(parseResult.errors || [])
  ];
  const persistence = options.persistenceService
    ? options.persistenceService.persistProcessingResult({
      documentType: "plan-individual",
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
      baseName: createReportBaseName(),
      tables: tableResult.tables,
      summary: tableResult.summary,
      validations: tableResult.validations,
      warnings,
      errors
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
    message: "Plan Individual procesado correctamente.",
    outputDir,
    files: exportResult.files,
    validation,
    readResult: { total: readResult.total, okCount: readResult.okCount, errorCount: readResult.errorCount },
    parseResult: { total: parseResult.total, parsedCount: parseResult.parsedCount, errorCount: parseResult.errorCount, errors: parseResult.errors },
    summary: tableResult.summary,
    persistence,
    warnings,
    errors
  };
}

module.exports = {
  ensureOutputDirectory,
  createTimestamp,
  createReportBaseName,
  normalizeValidFiles,
  processReport
};
