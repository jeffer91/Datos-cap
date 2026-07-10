/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/informe-final/tables.js
Función o funciones:
- Construir seis tablas no relacionales de Informes Finales.
- Separar archivo, datos generales, participantes, resultados, resumen y responsables.
- Normalizar columnas para Excel, JSON y futura base de datos.
- Validar campos obligatorios y resumir advertencias.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_informe_final",
  datos: "datos_informe_final",
  participantes: "participantes_informe_final",
  resultados: "resultados_informe_final",
  resumen: "resumen_informe_final",
  responsables: "responsables_informe_final"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: [
    "id", "id_documento", "nombre_archivo", "ruta_archivo", "hash_archivo",
    "codigo_documento", "numero_registro", "periodo", "anio_periodo", "mes_periodo",
    "version_documento", "fecha_elaboracion_texto", "fecha_elaboracion",
    "total_paginas_reales", "paginas_declaradas", "variantes_paginas_declaradas",
    "inconsistencia_paginas", "metodo_extraccion", "paginas_ocr", "confianza_ocr",
    "estado_extraccion", "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.datos]: [
    "id", "id_documento", "codigo_documento", "periodo", "nombre_capacitacion",
    "dirigido_a", "carrera_publico", "facilitador", "fecha_inicio_texto", "fecha_inicio",
    "fecha_fin_texto", "fecha_fin", "duracion_texto", "duracion_horas",
    "objetivo_general_y_especificos", "cumplimiento_objetivos",
    "total_participantes_extraidos", "total_masculino", "total_femenino",
    "total_otro_genero", "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.participantes]: [
    "id", "id_documento", "codigo_documento", "periodo", "nombre_capacitacion",
    "numero_participante", "nombres_apellidos", "cedula_identidad",
    "tiene_discapacidad", "tipo_discapacidad", "posee_carne_discapacidad", "genero",
    "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.resultados]: [
    "id", "id_documento", "codigo_documento", "periodo", "nombre_capacitacion",
    "numero_participante", "nombres_apellidos", "cedula_identidad",
    "certificado_aprobacion", "certificado_participacion", "certificado_facilitador",
    "reprobo_curso", "deserto_curso", "resultado_final", "requiere_revision",
    "observacion_extraccion"
  ],
  [TABLE_NAMES.resumen]: [
    "id", "id_documento", "codigo_documento", "periodo", "nombre_capacitacion",
    "total_inscritos", "total_certificado_aprobacion", "total_certificado_participacion",
    "total_certificado_facilitador", "total_desertores", "total_reprobados",
    "requiere_revision", "observacion_extraccion"
  ],
  [TABLE_NAMES.responsables]: [
    "id", "id_documento", "codigo_documento", "periodo", "nombre_capacitacion",
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
    [TABLE_NAMES.datos]: documents.map((document) => normalizeRow(document.datos_generales, COLUMNS[TABLE_NAMES.datos])),
    [TABLE_NAMES.participantes]: documents.flatMap((document) => (document.participantes || []).map((row) => normalizeRow(row, COLUMNS[TABLE_NAMES.participantes]))),
    [TABLE_NAMES.resultados]: documents.flatMap((document) => (document.resultados || []).map((row) => normalizeRow(row, COLUMNS[TABLE_NAMES.resultados]))),
    [TABLE_NAMES.resumen]: documents.map((document) => normalizeRow(document.resumen, COLUMNS[TABLE_NAMES.resumen])),
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
      "id_documento", "codigo_documento", "nombre_capacitacion", "facilitador",
      "fecha_inicio", "fecha_fin", "duracion_horas"
    ]),
    [TABLE_NAMES.participantes]: validateRows(data[TABLE_NAMES.participantes], [
      "id_documento", "numero_participante", "nombres_apellidos", "cedula_identidad", "genero"
    ]),
    [TABLE_NAMES.resultados]: validateRows(data[TABLE_NAMES.resultados], [
      "id_documento", "nombres_apellidos", "cedula_identidad", "resultado_final"
    ]),
    [TABLE_NAMES.resumen]: validateRows(data[TABLE_NAMES.resumen], [
      "id_documento", "total_inscritos", "total_certificado_aprobacion"
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

  const resumenRows = tables[TABLE_NAMES.resumen] || [];
  const totalInscritos = resumenRows.reduce((sum, row) => sum + Number(row.total_inscritos || 0), 0);
  const totalAprobados = resumenRows.reduce((sum, row) => sum + Number(row.total_certificado_aprobacion || 0), 0);

  return {
    total_tables: Object.values(TABLE_NAMES).length,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: revisionRows,
    total_inscritos: totalInscritos,
    total_aprobados: totalAprobados,
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
