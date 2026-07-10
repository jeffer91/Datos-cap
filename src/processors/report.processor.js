/* =========================================================
Nombre completo: report.processor.js
Ruta o ubicación: /src/processors/report.processor.js
Función o funciones:
- Ejecutar el proceso completo de generación de reportes.
- Recibir la definición del tipo documental seleccionado.
- Leer PDF, parsear campos, construir tablas y exportar Excel + JSON.
- Mantener compatibilidad con el módulo actual de Plan Individual.
========================================================= */

"use strict";

const fs = require("fs");
const { readPdfFiles } = require("../extractor/pdf.reader");
const { parsePdfDocuments } = require("../extractor/fields.parser");
const { buildAllTables, flattenValidationWarnings } = require("../tables");
const { exportAll } = require("../exporters");
const { createReportBaseName } = require("../utils/date.utils");

function normalizePath(value) {
  return String(value || "").trim();
}

function ensureOutputDirectory(outputDir) {
  const cleanDir = normalizePath(outputDir);
  if (!cleanDir) throw new Error("Debes seleccionar una carpeta de salida.");
  if (!fs.existsSync(cleanDir)) fs.mkdirSync(cleanDir, { recursive: true });
  const stat = fs.statSync(cleanDir);
  if (!stat.isDirectory()) throw new Error("La salida seleccionada no es una carpeta válida.");
  return cleanDir;
}

function normalizeValidFiles(files) {
  return (Array.isArray(files) ? files : [])
    .filter((file) => file && file.valid && file.path)
    .map((file) => file.path);
}

function createTableExportConfig(definition) {
  const tables = definition && Array.isArray(definition.tables) ? definition.tables : [];
  const sheetOrder = tables.map((table) => table.name).filter(Boolean);
  const sheetLabels = tables.reduce((output, table) => {
    if (table && table.name) output[table.name] = table.sheet || table.name;
    return output;
  }, {});

  return { sheetOrder, sheetLabels };
}

function createExportPayload(options) {
  const config = options || {};
  const definition = config.definition || {};
  const validation = config.validation || {};
  const readResult = config.readResult || {};
  const parseResult = config.parseResult || {};
  const tableResult = config.tableResult || {};
  const validationWarnings = flattenValidationWarnings(tableResult.validations || {});
  const tableConfig = createTableExportConfig(definition);

  return {
    outputDir: config.outputDir,
    baseName: config.baseName || createReportBaseName(definition.reportPrefix || "reporte_documental"),
    documentType: definition.id || config.documentType || "",
    documentLabel: definition.label || "",
    tables: tableResult.tables || {},
    sheetOrder: tableConfig.sheetOrder,
    sheetLabels: tableConfig.sheetLabels,
    summary: {
      ...(tableResult.summary || {}),
      tipo_documental: definition.id || "",
      nombre_tipo_documental: definition.label || "",
      pdf_seleccionados: validation.total || 0,
      pdf_validos: validation.validCount || 0,
      pdf_invalidos: validation.invalidCount || 0,
      pdf_duplicados: validation.duplicateCount || 0,
      pdf_alertas_tipo: validation.typeWarningCount || 0,
      pdf_leidos: readResult.okCount || 0,
      pdf_con_error_lectura: readResult.errorCount || 0,
      pdf_parseados: parseResult.parsedCount || 0,
      pdf_con_error_parseo: parseResult.errorCount || 0
    },
    validations: tableResult.validations || {},
    warnings: validationWarnings,
    errors: [
      ...((validation.invalidFiles || []).map((file) => ({ archivo: file.name, errores: file.errors || [] }))),
      ...((parseResult.errors || []).map((error) => error))
    ]
  };
}

async function processReport(options) {
  const config = options || {};
  const definition = config.definition || {};
  const outputDir = ensureOutputDirectory(config.outputDir);
  const validation = config.validation;

  if (!validation || !validation.canContinue) {
    return { ok: false, message: "No hay PDF válidos para procesar.", files: {}, summary: {}, validation: validation || {} };
  }

  const validPaths = normalizeValidFiles(validation.validFiles);
  if (!validPaths.length) {
    return { ok: false, message: "La validación no contiene rutas PDF válidas.", files: {}, summary: {}, validation };
  }

  const readResult = await readPdfFiles(validPaths);
  const parseResult = parsePdfDocuments(readResult.documents);
  const tableResult = buildAllTables(parseResult);
  const exportPayload = createExportPayload({
    outputDir,
    baseName: config.baseName,
    documentType: config.documentType,
    definition,
    validation,
    readResult,
    parseResult,
    tableResult
  });
  const exportResult = exportAll(exportPayload);

  return {
    ok: true,
    message: "Reporte generado correctamente.",
    documentType: definition.id || config.documentType || "",
    outputDir,
    files: exportResult.files,
    validation,
    readResult: { total: readResult.total, okCount: readResult.okCount, errorCount: readResult.errorCount },
    parseResult: {
      total: parseResult.total,
      parsedCount: parseResult.parsedCount,
      errorCount: parseResult.errorCount,
      errors: parseResult.errors
    },
    summary: exportPayload.summary,
    warnings: exportPayload.warnings,
    errors: exportPayload.errors
  };
}

function validateProcessorInput(options) {
  const config = options || {};
  const issues = [];
  if (!config.outputDir) issues.push("Falta outputDir.");
  if (!config.validation) issues.push("Falta objeto validation.");
  if (config.validation && !Array.isArray(config.validation.validFiles)) {
    issues.push("validation.validFiles debe ser un arreglo.");
  }
  return { ok: issues.length === 0, issues };
}

module.exports = {
  normalizePath,
  ensureOutputDirectory,
  normalizeValidFiles,
  createTableExportConfig,
  createExportPayload,
  processReport,
  validateProcessorInput
};
