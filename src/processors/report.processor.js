/* =========================================================
Nombre completo: report.processor.js
Ruta o ubicación: /src/processors/report.processor.js
Función o funciones:
- Ejecutar el proceso completo de generación de reportes.
- Leer PDF, aplicar OCR, parsear, validar y construir tablas.
- Guardar documentos y filas en la base local antes de exportar.
- Generar Excel y JSON y finalizar el historial de cada ejecución.
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

async function readDocuments(processor, filePaths) {
  if (processor && typeof processor.readDocuments === "function") {
    return processor.readDocuments(filePaths);
  }
  return readPdfFiles(filePaths);
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
    ? tableValidation.warnings.map((warning) => ({ etapa: "tablas", advertencia: String(warning || "") }))
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
  const databaseResult = config.databaseResult || {};
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
      pdf_duplicados_base_local: validation.localDuplicateCount || 0,
      pdf_alertas_tipo: validation.typeWarningCount || 0,
      pdf_leidos: readResult.okCount || 0,
      pdf_con_error_lectura: readResult.errorCount || 0,
      pdf_texto_digital: readResult.digitalCount || 0,
      pdf_procesados_ocr: readResult.ocrCount || 0,
      pdf_parseados: parseResult.parsedCount || 0,
      pdf_con_error_parseo: parseResult.errorCount || 0,
      advertencias_modulo: moduleWarnings.length,
      base_local_documentos_guardados: databaseResult.documentsSaved || 0,
      base_local_documentos_duplicados_omitidos: databaseResult.duplicateDocumentsSkipped || 0,
      base_local_versiones_superadas: databaseResult.supersededVersions || 0,
      base_local_filas_guardadas: databaseResult.rowsSaved || 0,
      base_local_ejecucion_id: databaseResult.runId || ""
    },
    validations: {
      archivos: validation,
      lectura: {
        total: readResult.total || 0,
        okCount: readResult.okCount || 0,
        errorCount: readResult.errorCount || 0,
        digitalCount: readResult.digitalCount || 0,
        ocrCount: readResult.ocrCount || 0
      },
      parseo: config.parseValidation || {},
      tablas: tableResult.validations || {},
      estructura: config.tableValidation || {},
      base_local: databaseResult
    },
    warnings: [...tableWarnings, ...moduleWarnings],
    errors: [
      ...((validation.invalidFiles || []).map((file) => ({ archivo: file.name, errores: file.errors || [] }))),
      ...((parseResult.errors || []).map((error) => error))
    ]
  };
}

function createFailure(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    files: {},
    summary: {},
    warnings: [],
    errors: [],
    ...extra
  };
}

async function processReport(options) {
  const config = options || {};
  const definition = config.definition || {};
  const processor = assertProcessorContract(config.processor);
  const outputDir = ensureOutputDirectory(config.outputDir);
  const validation = config.validation;
  const startedAt = new Date().toISOString();

  if (!validation || !validation.canContinue) {
    return createFailure("NO_VALID_FILES", "No hay PDF válidos para procesar.", {
      validation: validation || {}
    });
  }

  const validPaths = normalizeValidFiles(validation.validFiles);
  if (!validPaths.length) {
    return createFailure("NO_VALID_PATHS", "La validación no contiene rutas PDF válidas.", { validation });
  }

  const readResult = await readDocuments(processor, validPaths);
  const parseResult = processor.parseDocuments(readResult.documents);
  const parseValidation = typeof processor.validateParseResult === "function"
    ? processor.validateParseResult(parseResult)
    : {};

  if (!parseResult || !Array.isArray(parseResult.parsed) || parseResult.parsed.length === 0) {
    return createFailure("NO_PARSED_DOCUMENTS", "No se pudo extraer ningún documento válido.", {
      documentType: definition.id || config.documentType || "",
      summary: {
        pdf_leidos: readResult.okCount || 0,
        pdf_con_error_lectura: readResult.errorCount || 0,
        pdf_texto_digital: readResult.digitalCount || 0,
        pdf_procesados_ocr: readResult.ocrCount || 0,
        pdf_parseados: 0
      },
      validation,
      parseResult,
      warnings: parseValidation.warnings || [],
      errors: parseResult ? (parseResult.errors || []) : []
    });
  }

  const tableResult = processor.buildTables(parseResult);
  const tableValidation = typeof processor.validateTableResult === "function"
    ? processor.validateTableResult(tableResult)
    : {};
  const tableWarnings = typeof processor.flattenWarnings === "function"
    ? processor.flattenWarnings(tableResult.validations || {})
    : [];

  if (tableValidation && tableValidation.ok === false) {
    return createFailure("INVALID_TABLE_STRUCTURE", "Las tablas generadas no cumplen la estructura esperada.", {
      documentType: definition.id || config.documentType || "",
      summary: tableResult.summary || {},
      validation,
      parseResult,
      tableValidation,
      warnings: tableValidation.warnings || []
    });
  }

  let databaseResult = {};
  if (config.persistenceService && typeof config.persistenceService.persistProcessingResult === "function") {
    try {
      databaseResult = config.persistenceService.persistProcessingResult({
        definition,
        documentType: config.documentType,
        processorId: processor.id || definition.processorId || definition.id,
        outputDir,
        validation,
        parseResult,
        tableResult,
        startedAt
      });
    } catch (error) {
      return createFailure("LOCAL_DATABASE_ERROR", `No se pudo guardar en la base local: ${error.message}`, {
        documentType: definition.id || config.documentType || "",
        summary: tableResult.summary || {},
        validation,
        parseResult,
        tableValidation,
        warnings: tableWarnings,
        errors: [{ message: error.message }]
      });
    }
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
    tableWarnings,
    databaseResult
  });

  let exportResult;
  try {
    exportResult = exportAll(exportPayload);
  } catch (error) {
    if (databaseResult.runId && config.persistenceService && typeof config.persistenceService.finalizeProcessingRun === "function") {
      try {
        config.persistenceService.finalizeProcessingRun(databaseResult.runId, {
          ok: false,
          outputDir,
          errorMessage: error.message
        });
      } catch (_finalizeError) {
        // El registro inicial permanece para diagnóstico.
      }
    }
    throw error;
  }

  if (databaseResult.runId && config.persistenceService && typeof config.persistenceService.finalizeProcessingRun === "function") {
    databaseResult.run = config.persistenceService.finalizeProcessingRun(databaseResult.runId, {
      ok: true,
      outputDir,
      files: exportResult.files
    });
    databaseResult.summary = config.persistenceService.getSummary();
  }

  return {
    ok: true,
    message: "Documento procesado, guardado localmente y exportado correctamente.",
    documentType: definition.id || config.documentType || "",
    processorId: processor.id || definition.processorId || definition.id,
    outputDir,
    files: exportResult.files,
    database: databaseResult,
    validation,
    readResult: {
      total: readResult.total,
      okCount: readResult.okCount,
      errorCount: readResult.errorCount,
      digitalCount: readResult.digitalCount || 0,
      ocrCount: readResult.ocrCount || 0
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
  readDocuments,
  createTableExportConfig,
  normalizeModuleWarnings,
  createExportPayload,
  createFailure,
  processReport,
  validateProcessorInput
};
