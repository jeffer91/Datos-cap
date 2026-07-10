/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/tables.js
Función o funciones:
- Construir cuatro tablas no relacionales de Acuerdos de Patrocinio.
- Separar archivo, datos generales, apoyos y responsables.
- Normalizar columnas para Excel, JSON y futura base de datos.
- Validar campos obligatorios y resumir advertencias.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_acuerdo_patrocinio",
  datos: "datos_acuerdo_patrocinio",
  apoyos: "apoyos_acuerdo_patrocinio",
  responsables: "responsables_acuerdo_patrocinio"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: [
    "id", "id_documento", "nombre_archivo", "ruta_archivo", "hash_archivo",
    "codigo_documento", "prefijo_institucional", "numero_registro", "periodo",
    "anio_periodo", "mes_periodo", "total_paginas", "metodo_extraccion",
    "paginas_ocr", "confianza_ocr", "estado_firma_documento", "estado_extraccion",
    "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.datos]: [
    "id", "id_documento", "codigo_documento", "periodo", "ciudad_acuerdo",
    "fecha_acuerdo", "fecha_acuerdo_texto", "dia_acuerdo", "mes_acuerdo",
    "anio_acuerdo", "nombre_docente", "cedula_docente", "carrera",
    "vinculacion_institucional", "nombre_capacitacion", "total_apoyos_marcados",
    "apoyo_principal", "porcentaje_financiamiento_parcial", "total_responsables",
    "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.apoyos]: [
    "id", "id_documento", "codigo_documento", "periodo", "docente",
    "capacitacion", "tipo_apoyo", "seleccionado", "porcentaje_financiamiento",
    "evidencia_texto", "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.responsables]: [
    "id", "id_documento", "codigo_documento", "periodo", "docente",
    "rol_responsable", "nombre_responsable", "cargo_responsable", "estado_firma",
    "requiere_revision", "observacion_extraccion"
  ]
});

function getParsedDocuments(parseResultOrDocuments) {
  if (Array.isArray(parseResultOrDocuments)) return parseResultOrDocuments;
  if (parseResultOrDocuments && Array.isArray(parseResultOrDocuments.parsed)) {
    return parseResultOrDocuments.parsed;
  }
  return [];
}

function normalizeRow(row, columns) {
  const source = row || {};
  return columns.reduce((output, column) => {
    const value = source[column];
    output[column] = typeof value === "undefined" || value === null ? "" : value;
    return output;
  }, {});
}

function buildTables(parseResultOrDocuments) {
  const documents = getParsedDocuments(parseResultOrDocuments);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((document) => normalizeRow(document.archivo, COLUMNS[TABLE_NAMES.archivos])),
    [TABLE_NAMES.datos]: documents.map((document) => normalizeRow(document.datos_acuerdo, COLUMNS[TABLE_NAMES.datos])),
    [TABLE_NAMES.apoyos]: documents.flatMap((document) => (document.apoyos || []).map((row) => normalizeRow(row, COLUMNS[TABLE_NAMES.apoyos]))),
    [TABLE_NAMES.responsables]: documents.flatMap((document) => (document.responsables || []).map((row) => normalizeRow(row, COLUMNS[TABLE_NAMES.responsables])))
  };
  const validations = validateTables(tables);
  const summary = createSummary(tables, validations);

  return { tables, validations, summary };
}

function validateRows(rows, requiredFields) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];

  data.forEach((row, index) => {
    requiredFields.forEach((field) => {
      if (row[field] === "" || row[field] === null || typeof row[field] === "undefined") {
        warnings.push(`Fila ${index + 1}: falta ${field}.`);
      }
    });
  });

  return {
    ok: warnings.length === 0,
    totalRows: data.length,
    warningCount: warnings.length,
    warnings
  };
}

function validateTables(tables) {
  const data = tables || {};

  return {
    [TABLE_NAMES.archivos]: validateRows(data[TABLE_NAMES.archivos], [
      "id_documento", "nombre_archivo", "codigo_documento", "periodo"
    ]),
    [TABLE_NAMES.datos]: validateRows(data[TABLE_NAMES.datos], [
      "id_documento", "codigo_documento", "nombre_docente", "cedula_docente",
      "nombre_capacitacion", "fecha_acuerdo"
    ]),
    [TABLE_NAMES.apoyos]: validateRows(data[TABLE_NAMES.apoyos], [
      "id_documento", "tipo_apoyo", "seleccionado"
    ]),
    [TABLE_NAMES.responsables]: validateRows(data[TABLE_NAMES.responsables], [
      "id_documento", "rol_responsable", "nombre_responsable"
    ])
  };
}

function createSummary(tables, validations) {
  const rowsByTable = {};
  const warningsByTable = {};
  let totalRows = 0;
  let totalWarnings = 0;
  let revisionRows = 0;

  Object.values(TABLE_NAMES).forEach((tableName) => {
    const rows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
    const validation = validations[tableName] || { warningCount: 0 };
    rowsByTable[tableName] = rows.length;
    warningsByTable[tableName] = validation.warningCount || 0;
    totalRows += rows.length;
    totalWarnings += validation.warningCount || 0;
    revisionRows += rows.filter((row) => row.requiere_revision === "SI").length;
  });

  const supportRows = tables[TABLE_NAMES.apoyos] || [];

  return {
    total_tables: Object.values(TABLE_NAMES).length,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: revisionRows,
    total_apoyos_marcados: supportRows.filter((row) => row.seleccionado === "SI").length,
    rows_by_table: rowsByTable,
    warnings_by_table: warningsByTable,
    estado_general: totalWarnings > 0 || revisionRows > 0 ? "REVISAR" : "OK"
  };
}

function flattenWarnings(validations) {
  const output = [];

  Object.entries(validations || {}).forEach(([tableName, validation]) => {
    (validation.warnings || []).forEach((warning) => {
      output.push({ tabla: tableName, advertencia: warning });
    });
  });

  return output;
}

module.exports = {
  TABLE_NAMES,
  COLUMNS,
  getParsedDocuments,
  normalizeRow,
  buildTables,
  validateRows,
  validateTables,
  createSummary,
  flattenWarnings
};
