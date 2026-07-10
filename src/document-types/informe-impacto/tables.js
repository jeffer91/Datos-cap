/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/informe-impacto/tables.js
Función o funciones:
- Construir siete tablas no relacionales del Informe de Impacto.
- Separar archivo, datos, indicadores, objetivos, metodología, análisis y responsables.
- Normalizar columnas para Excel, JSON y futura base local.
========================================================= */

"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_informe_impacto",
  datos: "datos_informe_impacto",
  indicadores: "indicadores_informe_impacto",
  objetivos: "objetivos_informe_impacto",
  metodologia: "metodologia_informe_impacto",
  analisis: "analisis_informe_impacto",
  responsables: "responsables_informe_impacto"
});

const COLUMNS = Object.freeze({
  [TABLE_NAMES.archivos]: ["id","id_documento","nombre_archivo","ruta_archivo","hash_archivo","codigo_documento","numero_registro","periodo","anio_periodo","mes_periodo","version_documento","fecha_elaboracion_texto","fecha_elaboracion","total_paginas_reales","paginas_declaradas","variantes_paginas_declaradas","inconsistencia_paginas","metodo_extraccion","paginas_ocr","confianza_ocr","estado_extraccion","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.datos]: ["id","id_documento","codigo_documento","periodo","nombre_curso","dirigido_a","carrera_publico","periodo_capacitacion_texto","fecha_inicio_texto","fecha_inicio","fecha_fin_texto","fecha_fin","facilitador","numero_participantes","fecha_elaboracion_texto","fecha_elaboracion","total_indicadores","total_indicadores_cualitativos","total_indicadores_cuantitativos","promedio_porcentajes","total_objetivos_evaluados","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.indicadores]: ["id","id_documento","codigo_documento","periodo","nombre_curso","tipo_impacto","indicador","resultado_texto","porcentaje","valor_numerico","unidad","fuente_seccion","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.objetivos]: ["id","id_documento","codigo_documento","periodo","nombre_curso","numero_objetivo","objetivo","porcentaje_cumplimiento","evaluacion_resultado","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.metodologia]: ["id","id_documento","codigo_documento","periodo","nombre_curso","metodologia_texto","metodos_medicion","instrumentos_medicion","incluye_escalas_satisfaccion","incluye_observacion","incluye_pruebas_conocimiento","incluye_entrevistas","requiere_revision","observacion_extraccion"],
  [TABLE_NAMES.analisis]: ["id","id_documento","codigo_documento","periodo","nombre_curso","objetivo_informe","resultados_cualitativos","resultados_cuantitativos","analisis_causalidad","variables_moderadoras","recomendaciones_principales","conclusiones","recomendaciones_finales","requiere_revision","observacion_extraccion"],
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
    [TABLE_NAMES.datos]: validateRows(tables[TABLE_NAMES.datos], ["id_documento","nombre_curso","facilitador","numero_participantes"]),
    [TABLE_NAMES.indicadores]: validateRows(tables[TABLE_NAMES.indicadores], ["id_documento","tipo_impacto","indicador","resultado_texto"]),
    [TABLE_NAMES.objetivos]: validateRows(tables[TABLE_NAMES.objetivos], ["id_documento","numero_objetivo","objetivo"]),
    [TABLE_NAMES.metodologia]: validateRows(tables[TABLE_NAMES.metodologia], ["id_documento","nombre_curso"]),
    [TABLE_NAMES.analisis]: validateRows(tables[TABLE_NAMES.analisis], ["id_documento","nombre_curso","objetivo_informe"]),
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
  const indicators = tables[TABLE_NAMES.indicadores] || [];
  return {
    total_tables: 7,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: revisionRows,
    total_indicadores: indicators.length,
    total_indicadores_cualitativos: indicators.filter((row) => row.tipo_impacto === "CUALITATIVO").length,
    total_indicadores_cuantitativos: indicators.filter((row) => row.tipo_impacto === "CUANTITATIVO").length,
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
    [TABLE_NAMES.indicadores]: documents.flatMap((d) => (d.indicadores || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.indicadores]))),
    [TABLE_NAMES.objetivos]: documents.flatMap((d) => (d.objetivos || []).map((r) => normalizeRow(r, COLUMNS[TABLE_NAMES.objetivos]))),
    [TABLE_NAMES.metodologia]: documents.map((d) => normalizeRow(d.metodologia, COLUMNS[TABLE_NAMES.metodologia])),
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
