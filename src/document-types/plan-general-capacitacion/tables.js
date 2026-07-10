/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/plan-general-capacitacion/tables.js
Función o funciones:
- Construir ocho tablas no relacionales del Plan de Capacitación.
- Separar objetivos, acciones, cronograma, seguimiento y recursos.
- Normalizar columnas para Excel, JSON y futura base local.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_plan_general_capacitacion",
  datos: "datos_plan_general_capacitacion",
  objetivos: "objetivos_plan_general_capacitacion",
  capacitaciones: "capacitaciones_planificadas",
  cronograma: "cronograma_plan_general_capacitacion",
  seguimiento: "seguimiento_plan_general_capacitacion",
  recursos: "recursos_plan_general_capacitacion",
  responsables: "responsables_plan_general_capacitacion"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: ["id","id_documento","nombre_archivo","ruta_archivo","hash_archivo","codigo_documento","numero_registro","periodo","anio_periodo","mes_periodo","version_documento","fecha_elaboracion_texto","fecha_elaboracion","total_paginas_reales","paginas_declaradas","variantes_paginas_declaradas","inconsistencia_paginas","metodo_extraccion","paginas_ocr","confianza_ocr","documento_unico_periodo","estado_extraccion","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.datos]: ["id","id_documento","codigo_documento","periodo","periodo_documental_texto","tipo_plan","fecha_elaboracion_texto","fecha_elaboracion","objetivo_general","total_objetivos","total_capacitaciones","total_capacitaciones_genericas","total_capacitaciones_especificas","total_carreras","carreras_incluidas","total_horas_planificadas","presupuesto_total_estimado","total_indicadores","total_recursos","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.objetivos]: ["id","id_documento","codigo_documento","periodo","tipo_objetivo","numero_objetivo","objetivo","eje_estrategico","indicador_asociado","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.capacitaciones]: ["id","id_documento","codigo_documento","periodo","numero_capacitacion","tipo_capacitacion","nivel_prioridad","carrera","necesidad_identificada","nombre_capacitacion","modalidad","fecha_inicio_texto","fecha_inicio","fecha_fin_texto","fecha_fin","duracion_horas","beneficiarios","facilitador_proveedor","responsable_ejecucion","presupuesto_estimado","fuente_financiamiento","resultado_esperado","estado_planificado","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.cronograma]: ["id","id_documento","codigo_documento","periodo","numero_etapa","actividad","capacitacion_asociada","fecha_inicio_texto","fecha_inicio","fecha_fin_texto","fecha_fin","responsable","producto_entregable","estado_planificado","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.seguimiento]: ["id","id_documento","codigo_documento","periodo","numero_indicador","indicador","formula","meta","frecuencia","medio_verificacion","responsable","momento_evaluacion","uso_resultado","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.recursos]: ["id","id_documento","codigo_documento","periodo","numero_recurso","tipo_recurso","descripcion_recurso","cantidad","costo_estimado","fuente_financiamiento","responsable","observacion_recurso","requiere_revision","observacion_extraccion"],
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
    [TABLE_NAMES.objetivos]: validateRows(tables[TABLE_NAMES.objetivos], ["id_documento","tipo_objetivo","objetivo"]),
    [TABLE_NAMES.capacitaciones]: validateRows(tables[TABLE_NAMES.capacitaciones], ["id_documento","numero_capacitacion","nombre_capacitacion"]),
    [TABLE_NAMES.cronograma]: validateRows(tables[TABLE_NAMES.cronograma], ["id_documento","numero_etapa","actividad"]),
    [TABLE_NAMES.seguimiento]: validateRows(tables[TABLE_NAMES.seguimiento], ["id_documento","numero_indicador","indicador"]),
    [TABLE_NAMES.recursos]: validateRows(tables[TABLE_NAMES.recursos], ["id_documento","numero_recurso","descripcion_recurso"]),
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
    total_tables: 8,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: revisionRows,
    total_capacitaciones: (tables[TABLE_NAMES.capacitaciones] || []).length,
    total_indicadores: (tables[TABLE_NAMES.seguimiento] || []).length,
    total_recursos: (tables[TABLE_NAMES.recursos] || []).length,
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
    [TABLE_NAMES.objetivos]: documents.flatMap((d) => (d.objetivos || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.objetivos]))),
    [TABLE_NAMES.capacitaciones]: documents.flatMap((d) => (d.capacitaciones || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.capacitaciones]))),
    [TABLE_NAMES.cronograma]: documents.flatMap((d) => (d.cronograma || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.cronograma]))),
    [TABLE_NAMES.seguimiento]: documents.flatMap((d) => (d.seguimiento || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.seguimiento]))),
    [TABLE_NAMES.recursos]: documents.flatMap((d) => (d.recursos || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.recursos]))),
    [TABLE_NAMES.responsables]: documents.flatMap((d) => (d.responsables || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.responsables])))
  };
  const validations = validateTables(tables);
  return { tables, validations, summary: createSummary(tables, validations) };
}

function flattenWarnings(validations) {
  return Object.entries(validations || {}).flatMap(([tabla, validation]) => (validation.warnings || []).map((advertencia) => ({ tabla, advertencia })));
}

module.exports = { TABLE_NAMES, COLUMNS, normalizeRow, validateRows, validateTables, createSummary, buildTables, flattenWarnings };
