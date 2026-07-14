/* =========================================================
Nombre completo: report.processor.js
Ruta o ubicación: /src/processors/report.processor.js
Función o funciones:
- Procesar Planes Individuales digitales, escaneados o mixtos.
- Guardar resultados en la base local y exportar Excel/JSON.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFilesHybrid } = require("../readers/pdf-hybrid.reader");
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
function applySourceMetadata(parsedDocuments, readDocuments) {
  const readByPath = new Map((readDocuments || []).map((document) => [document.filePath, document]));
  (parsedDocuments || []).forEach((document) => {
    const file = document.archivo || {};
    const source = readByPath.get(file.ruta_archivo) || (readDocuments || []).find((item) => item.fileName === file.nombre_archivo);
    if (!source) return;
    file.hash_archivo = source.fileHash || file.hash_archivo || "";
    file.total_paginas = source.pageCount || file.total_paginas || 0;
    file.metodo_extraccion = source.extractionMethod || "digital";
    file.paginas_digitales = source.digitalPageCount || 0;
    file.paginas_ocr = source.ocrPageCount || 0;
    file.confianza_ocr = source.ocrConfidence || 0;
    document.archivo = file;
    document.source = {
      ...(document.source || {}),
      file_hash: source.fileHash || "",
      extraction_method: source.extractionMethod || "digital",
      digital_pages: source.digitalPageCount || 0,
      ocr_pages: source.ocrPageCount || 0,
      ocr_confidence: source.ocrConfidence || 0
    };
  });
}

async function processReport(options = {}) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const validation = options.validation;
  if (!validation?.canContinue) return { ok: false, message: "No hay PDF válidos para procesar.", files: {}, summary: {} };
  const paths = normalizeValidFiles(validation.validFiles);
  if (!paths.length) return { ok: false, message: "La validación no contiene rutas PDF válidas.", files: {}, summary: {} };

  const readResult = await readPdfFilesHybrid(paths, {
    onDocumentStart: options.onDocumentStart,
    onModeChange: options.onModeChange,
    onProgress: options.onOcrProgress,
    onPageStart: options.onPageStart,
    onPageRender: options.onPageRender,
    ocr: { maxPages: 40, scale: 2.2 }
  });
  const parseResult = parsePdfDocuments(readResult.documents);
  applySourceMetadata(parseResult.parsed, readResult.documents);
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
      errorCount: parseResult.errorCount,
      errors: parseResult.errors
    },
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
  applySourceMetadata,
  processReport
};
