/* =========================================================
Nombre completo: acuerdo-patrocinio.processor.js
Ruta o ubicación: /src/processors/acuerdo-patrocinio.processor.js
Función o funciones:
- Procesar Acuerdos de Patrocinio digitales, escaneados o mixtos.
- Admitir PDF individuales y carpetas con varios niveles.
- Comparar la capacitación del PDF con la carpeta de origen.
- Guardar resultados en la base local y exportar Excel/JSON.
========================================================= */
"use strict";

const fs = require("fs");
const { readPdfFilesHybrid } = require("../readers/pdf-hybrid.reader");
const { exportAll } = require("../exporters");
const { toDisplayPath } = require("../utils/file.utils");
const agreement = require("../document-types/acuerdo-patrocinio");
const { applyAgreementFolderContext } = require("../document-types/acuerdo-patrocinio/folder-context");

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
function validFiles(validation) {
  return (validation?.validFiles || []).filter((file) => file.valid && file.path);
}
function pathKey(filePath) {
  return String(toDisplayPath(filePath) || "").replace(/\//g, "\\").toLowerCase();
}
function enrichDocumentsWithFolderContext(parsedDocuments, selectedFiles) {
  const metadataByPath = new Map((selectedFiles || []).map((file) => [pathKey(file.path), file]));
  return (parsedDocuments || []).map((document) => {
    const metadata = metadataByPath.get(pathKey(document?.archivo?.ruta_archivo));
    return applyAgreementFolderContext(document, metadata || { path: document?.archivo?.ruta_archivo || "", sourceType: "individual" });
  });
}
function buildAgreementStructureSummary(documents) {
  const rows = documents || [];
  const statuses = rows.map((document) => document?.training_reconciliation?.status || "NO_DETERMINADA");
  const trainings = new Set(rows.map((document) => document?.datos_acuerdo?.capacitacion_final || document?.datos_acuerdo?.nombre_capacitacion).filter(Boolean));
  return {
    total_capacitaciones_detectadas: trainings.size,
    carga_desde_carpetas: rows.filter((document) => document?.archivo?.origen_carga === "CARPETA").length,
    carga_pdf_individual: rows.filter((document) => document?.archivo?.origen_carga === "PDF_INDIVIDUAL").length,
    coincidencias_confirmadas: statuses.filter((status) => status === "CONFIRMADA").length,
    coincidencias_probables: statuses.filter((status) => status === "PROBABLE").length,
    conflictos_carpeta_pdf: statuses.filter((status) => status === "CONFLICTO").length,
    capacitacion_solo_carpeta: statuses.filter((status) => status === "SOLO_CARPETA").length,
    capacitacion_solo_pdf: statuses.filter((status) => status === "SOLO_PDF" || status === "SIN_CARPETA_IDENTIFICABLE").length,
    capacitacion_no_determinada: statuses.filter((status) => status === "NO_DETERMINADA").length
  };
}

async function processAgreementReport(options = {}) {
  const outputDir = ensureOutputDirectory(options.outputDir);
  const selectedFiles = validFiles(options.validation);
  const paths = selectedFiles.map((file) => file.path);
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
  parseResult.parsed = enrichDocumentsWithFolderContext(parseResult.parsed, selectedFiles);
  const tableResult = agreement.tables.buildTables(parseResult);
  const summary = { ...tableResult.summary, ...buildAgreementStructureSummary(parseResult.parsed) };
  const warnings = [
    ...agreement.tables.flattenWarnings(tableResult.validations),
    ...parseResult.parsed.flatMap((document) => (document.warnings || []).map((advertencia) => ({
      id_documento: document.id_documento,
      advertencia
    })))
  ];
  const persistence = options.persistenceService
    ? options.persistenceService.persistProcessingResult({
      documentType: "acuerdo-patrocinio",
      parsedDocuments: parseResult.parsed,
      tables: tableResult.tables,
      outputDir,
      summary
    })
    : null;

  let exportResult;
  try {
    exportResult = exportAll({
      outputDir,
      baseName: `reporte_acuerdos_patrocinio_${timestamp()}`,
      tables: tableResult.tables,
      summary,
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
    summary,
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
  validFiles,
  enrichDocumentsWithFolderContext,
  buildAgreementStructureSummary,
  processAgreementReport
};