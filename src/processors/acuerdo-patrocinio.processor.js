/* =========================================================
Nombre completo: acuerdo-patrocinio.processor.js
Ruta o ubicación: /src/processors/acuerdo-patrocinio.processor.js
Función o funciones:
- Leer, extraer, guardar y exportar Acuerdos de Patrocinio.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFiles } = require("../extractor/pdf.reader");
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
  const d = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function validPaths(validation) {
  return (validation?.validFiles || []).filter((file) => file.valid && file.path).map((file) => file.path);
}

async function processAgreementReport(options = {}) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const paths = validPaths(options.validation);
  if (!paths.length) return { ok: false, message: "No hay acuerdos válidos para procesar.", files: {}, summary: {} };

  const readResult = await readPdfFiles(paths);
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
    readResult: { total: readResult.total, okCount: readResult.okCount, errorCount: readResult.errorCount },
    parseResult: { total: parseResult.total, parsedCount: parseResult.parsedCount, errorCount: parseResult.errorCount },
    persistence,
    warnings,
    errors: parseResult.errors
  };
}

module.exports = { processAgreementReport };
