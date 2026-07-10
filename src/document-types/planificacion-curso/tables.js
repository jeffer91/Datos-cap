/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/planificacion-curso/tables.js
Función o funciones:
- Construir las cuatro tablas no relacionales de planificación por curso.
- Normalizar columnas para Excel, JSON y futura base de datos.
- Validar campos obligatorios y resumir filas con advertencias.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_planificacion_curso",
  datosGenerales: "datos_generales_capacitacion",
  unidades: "unidades_capacitacion",
  evaluaciones: "evaluaciones_capacitacion"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: [
    "id", "id_documento", "nombre_archivo", "ruta_archivo", "hash_archivo",
    "codigo_documento", "numero_registro", "periodo", "anio_periodo", "mes_periodo",
    "version_documento", "fecha_elaboracion", "total_paginas", "metodo_extraccion",
    "paginas_ocr", "confianza_ocr", "estado_extraccion", "requiere_revision",
    "observacion_extraccion"
  ],
  [TABLE_NAMES.datosGenerales]: [
    "id", "id_documento", "codigo_documento", "periodo", "nombre_curso",
    "descripcion_curso", "dirigido_a", "carrera_publico", "forma_ejecucion",
    "tipo_capacitacion", "caracter_capacitacion", "modalidad", "tipo_certificado",
    "objetivo_general", "fecha_inicio", "fecha_fin", "ambiente_aprendizaje",
    "facilitador", "total_horas", "elaborado_por", "cargo_elaborador", "revisado_por",
    "cargo_revisor", "aprobado_por", "cargo_aprobador", "requiere_revision",
    "observacion_extraccion"
  ],
  [TABLE_NAMES.unidades]: [
    "id", "id_documento", "codigo_documento", "nombre_curso", "numero_unidad",
    "nombre_unidad", "contenidos", "horas_teoricas", "horas_practicas",
    "trabajo_autonomo", "total_horas", "logro_aprendizaje", "requiere_revision",
    "observacion_extraccion"
  ],
  [TABLE_NAMES.evaluaciones]: [
    "id", "id_documento", "codigo_documento", "nombre_curso", "orden_evaluacion",
    "parametro_evaluacion", "tematica_evaluada", "numero_instrumentos",
    "tipo_evaluacion", "requiere_revision", "observacion_extraccion"
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
    [TABLE_NAMES.datosGenerales]: documents.map((document) => normalizeRow(document.datos_generales, COLUMNS[TABLE_NAMES.datosGenerales])),
    [TABLE_NAMES.unidades]: documents.flatMap((document) => (document.unidades || []).map((row) => normalizeRow(row, COLUMNS[TABLE_NAMES.unidades]))),
    [TABLE_NAMES.evaluaciones]: documents.flatMap((document) => (document.evaluaciones || []).map((row) => normalizeRow(row, COLUMNS[TABLE_NAMES.evaluaciones])))
  };
  const validations = validateTables(tables);
  const summary = createSummary(tables, validations);

  return {
    tables,
    validations,
    summary
  };
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
    [TABLE_NAMES.datosGenerales]: validateRows(data[TABLE_NAMES.datosGenerales], [
      "id_documento", "codigo_documento", "nombre_curso", "descripcion_curso"
    ]),
    [TABLE_NAMES.unidades]: validateRows(data[TABLE_NAMES.unidades], [
      "id_documento", "nombre_curso", "numero_unidad", "nombre_unidad"
    ]),
    [TABLE_NAMES.evaluaciones]: validateRows(data[TABLE_NAMES.evaluaciones], [
      "id_documento", "nombre_curso", "parametro_evaluacion", "numero_instrumentos"
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

  return {
    total_tables: Object.values(TABLE_NAMES).length,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: revisionRows,
    rows_by_table: rowsByTable,
    warnings_by_table: warningsByTable,
    estado_general: totalWarnings > 0 || revisionRows > 0 ? "REVISAR" : "OK"
  };
}

function flattenWarnings(validations) {
  const output = [];

  Object.entries(validations || {}).forEach(([tableName, validation]) => {
    (validation.warnings || []).forEach((warning) => {
      output.push({
        tabla: tableName,
        advertencia: warning
      });
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
