/* =========================================================
Nombre completo: report.processor.js
Ruta o ubicación: /src/processors/report.processor.js
Función o funciones:
- Ejecutar el proceso completo de generación de reportes.
- Recibir definición y procesador especializado del tipo documental.
- Leer PDF, parsear, validar, construir tablas y exportar Excel + JSON.
- Mantener un pipeline común sin depender de un documento concreto.
========================================================= */

"use strict";

const fs = require("fs");
const { readPdfFiles } = require("../extractor/pdf.reader");
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

function assertProcessorContract(processor) {
  const moduleProcessor = processor || {};
  const missing = [];

  if (typeof moduleProcessor.parseDocuments !== "function") missing.push("parseDocuments");
  if (typeof moduleProcessor.buildTables !== "function") missing.push("buildTables");

  if (missing.length) {
    throw new Error(`El procesador documental está incompleto. Faltan: ${missing.join(", ")}.`);
  }

  return moduleProcessor;
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

function normalizeModuleWarnings(parseValidation, tableValidation) {
  const parseWarnings = parseValidation && Array.isArray(parseValidation.warnings)
    ? parseValidation.warnings.map((warning) => ({
      etapa: "parseo",
      ...((warning && typeof warning === "object") ? warning : { advertencia: String(warning || "") })
    }))
    : [];
  const tableWarnings = tableValidation && Array.isArray(tableValidation.warnings)
    ? tableValidation.warnings.map((warning) => ({
      etapa: "tablas",
      advertencia: String(warning || "")
    }))
    : [];

  return [...parseWarnings, ...tableWarnings];
}

function createExportPayload(options) {
  const config = options || {};
  const definition = config.definition || {};
  const validation = config.validation || {};
  const readResult = config.readResult || {};
  const parseResult = config.parseResult || {};
  const tableResult = config.tableResult || {};
  const tableWarnings = Array.isArray(config.tableWarnings) ? config.tableWarnings : [];
  const moduleWarnings = normalizeModuleWarnings(config.parseValidation, config.tableValidation);
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
      procesador_documental: config.processorId || "",
      pdf_seleccionados: validation.total || 0,
      pdf_validos: validation.validCount || 0,
      pdf_invalidos: validation.invalidCount || 0,
      pdf_duplicados: validation.duplicateCount || 0,
      pdf_alertas_tipo: validation.typeWarningCount || 0,
      pdf_leidos: readResult.okCount || 0,
      pdf_con_error_lectura: readResult.errorCount || 0,
      pdf_parseados: parseResult.parsedCount || 0,
      pdf_con_error_parseo: parseResult.errorCount || 0,
      advertencias_modulo: moduleWarnings.length
    },
    validations: {
      archivos: validation,
      parseo: config.parseValidation || {},
      tablas: tableResult.validations || {},
      estructura: config.tableValidation || {}
    },
    warnings: [...tableWarnings, ...moduleWarnings],
    errors: [
      ...((validation.invalidFiles || []).map((file) => ({ archivo: file.name, errores: file.errors || [] }))),
      ...((parseResult.errors || []).map((error) => error))
    ]
  };
}

async function processReport(options) {
  const config = options || {};
  const definition = config.definition || {};
  const processor = assertProcessorContract(config.processor);
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
  const parseResult = processor.parseDocuments(readResult.documents);
  const parseValidation = typeof processor.validateParseResult === "function"
    ? processor.validateParseResult(parseResult)
    : {};

  if (!parseResult || !Array.isArray(parseResult.parsed) || parseResult.parsed.length === 0) {
    return {
      ok: false,
      code: "NO_PARSED_DOCUMENTS",
      message: "No se pudo extraer ningún documento válido.",
      documentType: definition.id || config.documentType || "",
      files: {},
      summary: {
        pdf_leidos: readResult.okCount || 0,
        pdf_con_error_lectura: readResult.errorCount || 0,
        pdf_parseados: 0
      },
      validation,
      parseResult,
      warnings: parseValidation.warnings || [],
      errors: parseResult ? (parseResult.errors || []) : []
    };
  }

  const tableResult = processor.buildTables(parseResult);
  const tableValidation = typeof processor.validateTableResult === "function"
    ? processor.validateTableResult(tableResult)
    : {};
  const tableWarnings = typeof processor.flattenWarnings === "function"
    ? processor.flattenWarnings(tableResult.validations || {})
    : [];

  if (tableValidation && tableValidation.ok === false) {
    return {
      ok: false,
      code: "INVALID_TABLE_STRUCTURE",
      message: "Las tablas generadas no cumplen la estructura esperada.",
      documentType: definition.id || config.documentType || "",
      files: {},
      summary: tableResult.summary || {},
      validation,
      parseResult,
      tableValidation,
      warnings: tableValidation.warnings || [],
      errors: []
    };
  }

  const exportPayload = createExportPayload({
    outputDir,
    baseName: config.baseName,
    documentType: config.documentType,
    definition,
    processorId: processor.id || definition.processorId || definition.id,
    validation,
    readResult,
    parseResult,
    parseValidation,
    tableResult,
    tableValidation,
    tableWarnings
  });
  const exportResult = exportAll(exportPayload);

  return {
    ok: true,
    message: "Reporte generado correctamente.",
    documentType: definition.id || config.documentType || "",
    processorId: processor.id || definition.processorId || definition.id,
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
    parseValidation,
    tableValidation,
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
  if (!config.processor) issues.push("Falta procesador especializado.");
  if (config.validation && !Array.isArray(config.validation.validFiles)) {
    issues.push("validation.validFiles debe ser un arreglo.");
  }
  return { ok: issues.length === 0, issues };
}

module.exports = {
  normalizePath,
  ensureOutputDirectory,
  normalizeValidFiles,
  assertProcessorContract,
  createTableExportConfig,
  normalizeModuleWarnings,
  createExportPayload,
  processReport,
  validateProcessorInput
};
