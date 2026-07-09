/* =========================================================
Nombre completo: report.processor.js
Ruta o ubicación: /plan-docente-extractor/src/processors/report.processor.js
Función o funciones:
- Ejecutar el proceso completo de generación de reporte desde una sola función.
- Leer PDF, parsear campos, construir tablas y exportar Excel + JSON.
- Centralizar resumen, advertencias y errores del proceso.
- Dejar lista la lógica para que main.js no tenga demasiada responsabilidad.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

const { readPdfFiles } = require("../extractor/pdf.reader");
const { parsePdfDocuments } = require("../extractor/fields.parser");
const { buildAllTables, flattenValidationWarnings } = require("../tables");
const { exportAll } = require("../exporters");

function normalizePath(value) {
  return String(value || "").trim();
}

function ensureOutputDirectory(outputDir) {
  const cleanDir = normalizePath(outputDir);

  if (!cleanDir) {
    throw new Error("Debes seleccionar una carpeta de salida.");
  }

  if (!fs.existsSync(cleanDir)) {
    fs.mkdirSync(cleanDir, { recursive: true });
  }

  const stat = fs.statSync(cleanDir);

  if (!stat.isDirectory()) {
    throw new Error("La salida seleccionada no es una carpeta válida.");
  }

  return cleanDir;
}

function createTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function createReportBaseName(prefix = "reporte_plan_individual") {
  return `${prefix}_${createTimestamp()}`;
}

function normalizeValidFiles(files) {
  const data = Array.isArray(files) ? files : [];

  return data
    .filter((file) => file && file.valid && file.path)
    .map((file) => file.path);
}

function createExportPayload(options) {
  const config = options || {};
  const validation = config.validation || {};
  const readResult = config.readResult || {};
  const parseResult = config.parseResult || {};
  const tableResult = config.tableResult || {};
  const validationWarnings = flattenValidationWarnings(tableResult.validations || {});

  return {
    outputDir: config.outputDir,
    baseName: config.baseName || createReportBaseName(),
    tables: tableResult.tables || {},
    summary: {
      ...(tableResult.summary || {}),
      pdf_seleccionados: validation.total || 0,
      pdf_validos: validation.validCount || 0,
      pdf_invalidos: validation.invalidCount || 0,
      pdf_leidos: readResult.okCount || 0,
      pdf_con_error_lectura: readResult.errorCount || 0,
      pdf_parseados: parseResult.parsedCount || 0,
      pdf_con_error_parseo: parseResult.errorCount || 0
    },
    validations: tableResult.validations || {},
    warnings: validationWarnings,
    errors: [
      ...((validation.invalidFiles || []).map((file) => ({
        archivo: file.name,
        errores: file.errors || []
      }))),
      ...((parseResult.errors || []).map((error) => error))
    ]
  };
}

async function processReport(options) {
  const config = options || {};
  const outputDir = ensureOutputDirectory(config.outputDir);
  const validation = config.validation;

  if (!validation || !validation.canContinue) {
    return {
      ok: false,
      message: "No hay PDF válidos para procesar.",
      files: {},
      summary: {},
      validation: validation || {}
    };
  }

  const validPaths = normalizeValidFiles(validation.validFiles);

  if (!validPaths.length) {
    return {
      ok: false,
      message: "La validación no contiene rutas PDF válidas.",
      files: {},
      summary: {},
      validation
    };
  }

  const readResult = await readPdfFiles(validPaths);
  const parseResult = parsePdfDocuments(readResult.documents);
  const tableResult = buildAllTables(parseResult);
  const exportPayload = createExportPayload({
    outputDir,
    baseName: config.baseName || createReportBaseName(),
    validation,
    readResult,
    parseResult,
    tableResult
  });

  const exportResult = exportAll(exportPayload);

  return {
    ok: true,
    message: "Reporte generado correctamente.",
    outputDir,
    files: exportResult.files,
    validation,
    readResult: {
      total: readResult.total,
      okCount: readResult.okCount,
      errorCount: readResult.errorCount
    },
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

  if (!config.outputDir) {
    issues.push("Falta outputDir.");
  }

  if (!config.validation) {
    issues.push("Falta objeto validation.");
  }

  if (config.validation && !Array.isArray(config.validation.validFiles)) {
    issues.push("validation.validFiles debe ser un arreglo.");
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

module.exports = {
  normalizePath,
  ensureOutputDirectory,
  createTimestamp,
  createReportBaseName,
  normalizeValidFiles,
  createExportPayload,
  processReport,
  validateProcessorInput
};
