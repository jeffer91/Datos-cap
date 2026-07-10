/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/deteccion-necesidades/tables.js
Función o funciones:
- Construir nueve tablas no relacionales de Detección de Necesidades.
- Separar archivo, diagnóstico, fuentes, necesidades, prioridades y análisis.
- Normalizar columnas para Excel, JSON y futura base local.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_deteccion_necesidades",
  datos: "datos_deteccion_necesidades",
  fuentes: "fuentes_deteccion_necesidades",
  institucionales: "necesidades_institucionales",
  necesidadesCarrera: "necesidades_por_carrera",
  prioridadesCarrera: "prioridades_por_carrera",
  consolidado: "consolidado_deteccion_necesidades",
  analisis: "analisis_deteccion_necesidades",
  responsables: "responsables_deteccion_necesidades"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: ["id","id_documento","nombre_archivo","ruta_archivo","hash_archivo","codigo_documento","numero_registro","periodo","anio_periodo","mes_periodo","version_documento","fecha_elaboracion_texto","fecha_elaboracion","total_paginas_reales","paginas_declaradas","variantes_paginas_declaradas","inconsistencia_paginas","metodo_extraccion","paginas_ocr","confianza_ocr","documento_unico_periodo","estado_extraccion","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.datos]: ["id","id_documento","codigo_documento","periodo","periodo_documental_texto","fecha_elaboracion_texto","fecha_elaboracion","total_respuestas_validas","total_fuentes_detectadas","total_necesidades_institucionales","capacitacion_generica_priorizada","total_necesidades_carrera","total_carreras_con_prioridad","total_registros_consolidados","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.fuentes]: ["id","id_documento","codigo_documento","periodo","fuente_id","fuente_informacion","herramienta","total_respuestas","evidencia_detectada","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.institucionales]: ["id","id_documento","codigo_documento","periodo","necesidad_capacitacion","presencia_institucional","porcentaje_recurrencia","es_capacitacion_generica_priorizada","capacitacion_generica_priorizada","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.necesidadesCarrera]: ["id","id_documento","codigo_documento","periodo","carrera","numero_necesidad","necesidad_capacitacion","tipo_necesidad","nivel_recurrencia","porcentaje_recurrencia","fuente_deteccion","es_priorizada","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.prioridadesCarrera]: ["id","id_documento","codigo_documento","periodo","carrera","capacitacion_priorizada","porcentaje_recurrencia","perfil_egreso","competencias_declaradas","impacto_docencia","pertinencia_curricular","alineacion_institucional","relacion_capacitacion_generica","origen_prioridad","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.consolidado]: ["id","id_documento","codigo_documento","periodo","tipo_registro","nivel_prioridad","alcance","carrera","capacitacion","categoria","porcentaje","caracteristicas","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.analisis]: ["id","id_documento","codigo_documento","periodo","objetivos_diagnostico","metodologia_diagnostico","conclusiones","recomendaciones_plan_capacitacion","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.responsables]: ["id","id_documento","codigo_documento","periodo","rol_responsable","nombre_responsable","cargo_responsable","estado_firma","requiere_revision","observacion_extraccion"]
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
    [TABLE_NAMES.datos]: validateRows(tables[TABLE_NAMES.datos], ["id_documento","periodo","periodo_documental_texto"]),
    [TABLE_NAMES.fuentes]: validateRows(tables[TABLE_NAMES.fuentes], ["id_documento","fuente_id","fuente_informacion"]),
    [TABLE_NAMES.institucionales]: validateRows(tables[TABLE_NAMES.institucionales], ["id_documento","necesidad_capacitacion"]),
    [TABLE_NAMES.necesidadesCarrera]: validateRows(tables[TABLE_NAMES.necesidadesCarrera], ["id_documento","carrera","necesidad_capacitacion"]),
    [TABLE_NAMES.prioridadesCarrera]: validateRows(tables[TABLE_NAMES.prioridadesCarrera], ["id_documento","carrera","capacitacion_priorizada"]),
    [TABLE_NAMES.consolidado]: validateRows(tables[TABLE_NAMES.consolidado], ["id_documento","tipo_registro","alcance"]),
    [TABLE_NAMES.analisis]: validateRows(tables[TABLE_NAMES.analisis], ["id_documento","metodologia_diagnostico"]),
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
  return {
    total_tables: 9,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: revisionRows,
    total_carreras: new Set((tables[TABLE_NAMES.prioridadesCarrera] || []).map((row) => row.carrera)).size,
    total_necesidades_carrera: (tables[TABLE_NAMES.necesidadesCarrera] || []).length,
    rows_by_table: rowsByTable,
    warnings_by_table: warningsByTable,
    estado_general: totalWarnings || revisionRows ? "REVISAR" : "OK"
  };
}

function buildTables(value) {
  const documents = documentsFrom(value);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((d) => normalizeRow(d.archivo, COLUMNS[TABLE_NAMES.archivos])),
    [TABLE_NAMES.datos]: documents.map((d) => normalizeRow(d.datos_generales, COLUMNS[TABLE_NAMES.datos])),
    [TABLE_NAMES.fuentes]: documents.flatMap((d) => (d.fuentes || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.fuentes]))),
    [TABLE_NAMES.institucionales]: documents.flatMap((d) => (d.necesidades_institucionales || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.institucionales]))),
    [TABLE_NAMES.necesidadesCarrera]: documents.flatMap((d) => (d.necesidades_carrera || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.necesidadesCarrera]))),
    [TABLE_NAMES.prioridadesCarrera]: documents.flatMap((d) => (d.prioridades_carrera || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.prioridadesCarrera]))),
    [TABLE_NAMES.consolidado]: documents.flatMap((d) => (d.consolidado || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.consolidado]))),
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
