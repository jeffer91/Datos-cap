/* =========================================================
Nombre completo: table.validator.js
Ruta o ubicación: /plan-docente-extractor/src/validators/table.validator.js
Función o funciones:
- Validar tablas JSON antes de exportarlas o enviarlas a base de datos.
- Verificar campos obligatorios por fila.
- Detectar IDs duplicados dentro de una tabla.
- Entregar advertencias normalizadas por tabla y fila.
========================================================= */

"use strict";

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isEmptyValue(value) {
  return cleanText(value) === "";
}

function validateRequiredFields(row, requiredFields) {
  const fields = Array.isArray(requiredFields) ? requiredFields : [];
  const missing = [];

  fields.forEach((field) => {
    if (isEmptyValue(row ? row[field] : "")) {
      missing.push(field);
    }
  });

  return missing;
}

function detectDuplicateIds(rows, idField = "id") {
  const data = Array.isArray(rows) ? rows : [];
  const seen = new Set();
  const duplicates = [];

  data.forEach((row, index) => {
    const id = cleanText(row ? row[idField] : "");

    if (!id) {
      return;
    }

    if (seen.has(id)) {
      duplicates.push({
        rowIndex: index,
        rowNumber: index + 1,
        id
      });
    } else {
      seen.add(id);
    }
  });

  return duplicates;
}

function validateTableRows(tableName, rows, options = {}) {
  const data = Array.isArray(rows) ? rows : [];
  const requiredFields = Array.isArray(options.requiredFields) ? options.requiredFields : [];
  const idField = options.idField || "id";
  const warnings = [];

  data.forEach((row, index) => {
    const missing = validateRequiredFields(row, requiredFields);

    if (missing.length) {
      warnings.push({
        tabla: tableName,
        fila: index + 1,
        tipo: "campos_faltantes",
        mensaje: `Fila ${index + 1}: faltan campos obligatorios: ${missing.join(", ")}.`,
        campos: missing
      });
    }
  });

  detectDuplicateIds(data, idField).forEach((duplicate) => {
    warnings.push({
      tabla: tableName,
      fila: duplicate.rowNumber,
      tipo: "id_duplicado",
      mensaje: `Fila ${duplicate.rowNumber}: ID duplicado ${duplicate.id}.`,
      campos: [idField]
    });
  });

  return {
    ok: warnings.length === 0,
    tableName,
    totalRows: data.length,
    warningCount: warnings.length,
    warnings
  };
}

function validateTables(tables, schema = {}) {
  const data = tables || {};
  const result = {};

  Object.keys(data).forEach((tableName) => {
    result[tableName] = validateTableRows(tableName, data[tableName], schema[tableName] || {});
  });

  return result;
}

function flattenTableWarnings(validations) {
  const data = validations || {};
  const output = [];

  Object.keys(data).forEach((tableName) => {
    const validation = data[tableName] || {};
    const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];

    warnings.forEach((warning) => {
      output.push(warning);
    });
  });

  return output;
}

module.exports = {
  cleanText,
  isEmptyValue,
  validateRequiredFields,
  detectDuplicateIds,
  validateTableRows,
  validateTables,
  flattenTableWarnings
};
