/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/planificacion-capacitacion/tables.js
Función o funciones:
- Construir ocho tablas independientes de Planificaciones de Capacitación.
- Validar campos obligatorios y resumir advertencias.
========================================================= */
"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_planificacion_capacitacion",
  datos: "datos_planificacion_capacitacion",
  temario: "temario_planificacion_capacitacion",
  evaluaciones: "evaluaciones_planificacion_capacitacion",
  responsables: "responsables_planificacion_capacitacion",
  facilitadores: "facilitadores_planificacion_capacitacion",
  anexos: "anexos_planificacion_capacitacion",
  ocrPaginas: "ocr_paginas_planificacion"
});

function getDocuments(input) {
  if (Array.isArray(input)) return input;
  return input && Array.isArray(input.parsed) ? input.parsed : [];
}

function validateRows(rows, requiredFields) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];
  data.forEach((row, index) => {
    requiredFields.forEach((field) => {
      if (row[field] === "" || row[field] == null) {
        warnings.push(`Fila ${index + 1}: falta ${field}.`);
      }
    });
  });
  return { ok: warnings.length === 0, totalRows: data.length, warningCount: warnings.length, warnings };
}

function buildTables(input) {
  const documents = getDocuments(input);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((document) => document.archivo),
    [TABLE_NAMES.datos]: documents.map((document) => document.datos_generales),
    [TABLE_NAMES.temario]: documents.flatMap((document) => document.unidades || []),
    [TABLE_NAMES.evaluaciones]: documents.flatMap((document) => document.evaluaciones || []),
    [TABLE_NAMES.responsables]: documents.flatMap((document) => document.responsables || []),
    [TABLE_NAMES.facilitadores]: documents.flatMap((document) => document.facilitadores || []),
    [TABLE_NAMES.anexos]: documents.flatMap((document) => document.anexos || []),
    [TABLE_NAMES.ocrPaginas]: documents.flatMap((document) => document.ocr_paginas || [])
  };

  const validations = {
    [TABLE_NAMES.archivos]: validateRows(tables[TABLE_NAMES.archivos], ["id_documento", "nombre_archivo", "codigo_documento", "periodo"]),
    [TABLE_NAMES.datos]: validateRows(tables[TABLE_NAMES.datos], ["id_documento", "nombre_curso", "carrera_publico"]),
    [TABLE_NAMES.temario]: validateRows(tables[TABLE_NAMES.temario], ["id_documento", "numero_unidad", "nombre_unidad"]),
    [TABLE_NAMES.evaluaciones]: validateRows(tables[TABLE_NAMES.evaluaciones], ["id_documento", "parametro_evaluacion"]),
    [TABLE_NAMES.responsables]: validateRows(tables[TABLE_NAMES.responsables], ["id_documento", "rol_responsable"]),
    [TABLE_NAMES.facilitadores]: validateRows(tables[TABLE_NAMES.facilitadores], ["id_documento"]),
    [TABLE_NAMES.anexos]: validateRows(tables[TABLE_NAMES.anexos], ["id_documento", "numero_pagina"]),
    [TABLE_NAMES.ocrPaginas]: validateRows(tables[TABLE_NAMES.ocrPaginas], ["id_documento", "numero_pagina"])
  };

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
    revisionRows += rows.filter((row) => row && row.requiere_revision === "SI").length;
  });

  return {
    tables,
    validations,
    summary: {
      total_tables: Object.values(TABLE_NAMES).length,
      total_rows: totalRows,
      total_warnings: totalWarnings,
      requiere_revision_rows: revisionRows,
      total_unidades: tables[TABLE_NAMES.temario].length,
      total_evaluaciones: tables[TABLE_NAMES.evaluaciones].length,
      total_paginas_ocr: tables[TABLE_NAMES.ocrPaginas].length,
      rows_by_table: rowsByTable,
      warnings_by_table: warningsByTable,
      estado_general: totalWarnings || revisionRows ? "REVISAR" : "OK"
    }
  };
}

function flattenWarnings(validations) {
  return Object.entries(validations || {}).flatMap(([tabla, validation]) =>
    (validation.warnings || []).map((advertencia) => ({ tabla, advertencia }))
  );
}

module.exports = {
  TABLE_NAMES,
  getDocuments,
  validateRows,
  buildTables,
  flattenWarnings
};
