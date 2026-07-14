/* =========================================================
Nombre completo: informe-final-capacitacion.processor.js
Ruta o ubicación: /src/processors/informe-final-capacitacion.processor.js
Función o funciones:
- Procesar Informes Finales digitales, escaneados o mixtos.
- Guardar datos relevantes y diferencias en la base local.
- Exportar nueve tablas a Excel y JSON.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFilesHybrid } = require("../readers/pdf-hybrid.reader");
const { exportAll } = require("../exporters");
const finalReports = require("../document-types/informe-final-capacitacion");

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

async function processFinalReport(options = {}) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const paths = getValidPaths(options.validation);
  if (!paths.length) {
    return { ok: false, message: "No hay Informes Finales válidos para procesar.", files: {}, summary: {} };
  }

  const readResult = await readPdfFilesHybrid(paths, {
    onDocumentStart: options.onDocumentStart,
    onModeChange: options.onModeChange,
    onProgress: options.onOcrProgress,
    onPageStart: options.onPageStart,
    onPageRender: options.onPageRender,
    ocr: { maxPages: 120, scale: 2.2 }
  });
  const parseResult = finalReports.parser.parseDocuments(readResult.documents);
  const documentValidations = parseResult.parsed.map((document) => finalReports.validator.validateParsedDocument(document));
  const tableResult = finalReports.tables.buildTables(parseResult);
  const warnings = [
    ...finalReports.tables.flattenWarnings(tableResult.validations),
    ...documentValidations.flatMap((validation) => validation.warnings.map((advertencia) => ({
      id_documento: validation.documentId,
      advertencia
    })))
  ];

  const persistence = options.persistenceService
    ? options.persistenceService.persistProcessingResult({
      documentType: "informe-final-capacitacion",
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
      baseName: `reporte_informes_finales_capacitacion_${timestamp()}`,
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
    message: "Informes Finales procesados correctamente.",
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
  getValidPaths,
  processFinalReport
};
