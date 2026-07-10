/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/tables.js
Función o funciones:
- Construir ocho tablas no relacionales del Instrumento de Evaluación.
- Separar archivo, datos, participantes, indicadores, Likert, objetivos, análisis y responsables.
- Normalizar columnas para Excel, JSON y futura base local.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_instrumento_evaluacion",
  datos: "datos_instrumento_evaluacion",
  participantes: "participantes_instrumento_evaluacion",
  indicadores: "indicadores_instrumento_evaluacion",
  likert: "likert_instrumento_evaluacion",
  objetivos: "objetivos_instrumento_evaluacion",
  analisis: "analisis_instrumento_evaluacion",
  responsables: "responsables_instrumento_evaluacion"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: ["id","id_documento","nombre_archivo","ruta_archivo","hash_archivo","codigo_documento","numero_registro","periodo","anio_periodo","mes_periodo","version_documento","fecha_elaboracion_texto","fecha_elaboracion","total_paginas_reales","paginas_declaradas","variantes_paginas_declaradas","inconsistencia_paginas","metodo_extraccion","paginas_ocr","confianza_ocr","estado_extraccion","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.datos]: ["id","id_documento","codigo_documento","periodo","nombre_curso","periodo_capacitacion_texto","facilitador","fecha_elaboracion_texto","fecha_elaboracion","dirigido_a","carrera_publico","total_participantes","total_masculino","total_femenino","total_otro_genero","total_indicadores","indicadores_con_resultado","total_objetivos","promedio_cumplimiento_objetivos","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.participantes]: ["id","id_documento","codigo_documento","periodo","nombre_curso","numero_participante","nombres_apellidos","cedula_identidad","tiene_discapacidad","tipo_discapacidad","posee_carne_discapacidad","genero","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.indicadores]: ["id","id_documento","codigo_documento","periodo","nombre_curso","grupo_indicador","criterio","indicador","resultado_texto","resultado_numerico","unidad_resultado","observaciones","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.likert]: ["id","id_documento","codigo_documento","periodo","nombre_curso","item_evaluado","marca_detectada","escala_likert","codigo_escala","evidencia_texto","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.objetivos]: ["id","id_documento","codigo_documento","periodo","nombre_curso","numero_objetivo","objetivo_aprendizaje","porcentaje_cumplido","observaciones","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.analisis]: ["id","id_documento","codigo_documento","periodo","nombre_curso","resultados_cualitativos","observaciones_generales","conclusiones","recomendaciones","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.responsables]: ["id","id_documento","codigo_documento","periodo","nombre_curso","rol_responsable","nombre_responsable","cargo_responsable","estado_firma","requiere_revision","observacion_extraccion"]
});

function documentsFrom(value) {
  if (Array.isArray(value)) return value;
  return value && Array.isArray(value.parsed) ? value.parsed : [];
}

function normalizeRow(row, columns) {
  const source = row || {};
  return columns.reduce((output, column) => {
    output[column] = source[column] === null || typeof source[column] === "undefined" ? "" : source[column];
    return output;
  }, {});
}

function validateRows(rows, required) {
  const warnings = [];
  (rows || []).forEach((row, index) => required.forEach((field) => {
    if (row[field] === "" || row[field] === null || typeof row[field] === "undefined") warnings.push(`Fila ${index + 1}: falta ${field}.`);
  }));
  return { ok: warnings.length === 0, totalRows: (rows || []).length, warningCount: warnings.length, warnings };
}

function validateTables(tables) {
  return {
    [TABLE_NAMES.archivos]: validateRows(tables[TABLE_NAMES.archivos], ["id_documento","nombre_archivo","codigo_documento","periodo"]),
    [TABLE_NAMES.datos]: validateRows(tables[TABLE_NAMES.datos], ["id_documento","nombre_curso","facilitador"]),
    [TABLE_NAMES.participantes]: validateRows(tables[TABLE_NAMES.participantes], ["id_documento","nombres_apellidos","cedula_identidad","genero"]),
    [TABLE_NAMES.indicadores]: validateRows(tables[TABLE_NAMES.indicadores], ["id_documento","criterio","indicador"]),
    [TABLE_NAMES.likert]: validateRows(tables[TABLE_NAMES.likert], ["id_documento","item_evaluado","marca_detectada"]),
    [TABLE_NAMES.objetivos]: validateRows(tables[TABLE_NAMES.objetivos], ["id_documento","objetivo_aprendizaje","porcentaje_cumplido"]),
    [TABLE_NAMES.analisis]: validateRows(tables[TABLE_NAMES.analisis], ["id_documento","nombre_curso"]),
    [TABLE_NAMES.responsables]: validateRows(tables[TABLE_NAMES.responsables], ["id_documento","rol_responsable","nombre_responsable"])
  };
}

function createSummary(tables, validations) {
  const rowsByTable = {};
  const warningsByTable = {};
  let totalRows = 0;
  let totalWarnings = 0;
  let revisionRows = 0;
  Object.values(TABLE_NAMES).forEach((name) => {
    const rows = tables[name] || [];
    rowsByTable[name] = rows.length;
    warningsByTable[name] = validations[name].warningCount;
    totalRows += rows.length;
    totalWarnings += validations[name].warningCount;
    revisionRows += rows.filter((row) => row.requiere_revision === "SI").length;
  });
  return { total_tables: 8, total_rows: totalRows, total_warnings: totalWarnings, requiere_revision_rows: revisionRows, rows_by_table: rowsByTable, warnings_by_table: warningsByTable, estado_general: totalWarnings || revisionRows ? "REVISAR" : "OK" };
}

function buildTables(value) {
  const documents = documentsFrom(value);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((d) => normalizeRow(d.archivo, COLUMNS[TABLE_NAMES.archivos])),
    [TABLE_NAMES.datos]: documents.map((d) => normalizeRow(d.datos_generales, COLUMNS[TABLE_NAMES.datos])),
    [TABLE_NAMES.participantes]: documents.flatMap((d) => (d.participantes || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.participantes]))),
    [TABLE_NAMES.indicadores]: documents.flatMap((d) => (d.indicadores || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.indicadores]))),
    [TABLE_NAMES.likert]: documents.flatMap((d) => (d.likert || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.likert]))),
    [TABLE_NAMES.objetivos]: documents.flatMap((d) => (d.objetivos || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.objetivos]))),
    [TABLE_NAMES.analisis]: documents.map((d) => normalizeRow(d.analisis, COLUMNS[TABLE_NAMES.analisis])),
    [TABLE_NAMES.responsables]: documents.flatMap((d) => (d.responsables || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.responsables])))
  };
  const validations = validateTables(tables);
  return { tables, validations, summary: createSummary(tables, validations) };
}

function flattenWarnings(validations) {
  return Object.entries(validations || {}).flatMap(([tabla, validation]) => (validation.warnings || []).map((advertencia) => ({ tabla, advertencia })));
}

module.exports = { TABLE_NAMES, COLUMNS, normalizeRow, validateRows, validateTables, createSummary, buildTables, flattenWarnings };
