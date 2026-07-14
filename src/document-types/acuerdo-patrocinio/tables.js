/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/tables.js
Función o funciones:
- Construir las cuatro tablas de los acuerdos de patrocinio.
- Validar campos principales y resumir advertencias.
========================================================= */
"use strict";

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_acuerdo_patrocinio",
  datos: "datos_acuerdo_patrocinio",
  apoyos: "apoyos_acuerdo_patrocinio",
  responsables: "responsables_acuerdo_patrocinio"
});

function parsedDocuments(input) {
  if (Array.isArray(input)) return input;
  return input && Array.isArray(input.parsed) ? input.parsed : [];
}
function validateRows(rows, required) {
  const warnings = [];
  (rows || []).forEach((row, index) => required.forEach((field) => {
    if (row[field] === "" || row[field] == null) warnings.push(`Fila ${index + 1}: falta ${field}.`);
  }));
  return { ok: warnings.length === 0, totalRows: (rows || []).length, warningCount: warnings.length, warnings };
}
function buildTables(input) {
  const documents = parsedDocuments(input);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((doc) => doc.archivo),
    [TABLE_NAMES.datos]: documents.map((doc) => doc.datos_acuerdo),
    [TABLE_NAMES.apoyos]: documents.flatMap((doc) => doc.apoyos || []),
    [TABLE_NAMES.responsables]: documents.flatMap((doc) => doc.responsables || [])
  };
  const validations = {
    [TABLE_NAMES.archivos]: validateRows(tables[TABLE_NAMES.archivos], ["id_documento", "codigo_documento", "periodo"]),
    [TABLE_NAMES.datos]: validateRows(tables[TABLE_NAMES.datos], ["id_documento", "nombre_docente", "cedula_docente", "nombre_capacitacion", "fecha_acuerdo"]),
    [TABLE_NAMES.apoyos]: validateRows(tables[TABLE_NAMES.apoyos], ["id_documento", "tipo_apoyo", "seleccionado"]),
    [TABLE_NAMES.responsables]: validateRows(tables[TABLE_NAMES.responsables], ["id_documento", "rol_responsable", "nombre_responsable"])
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
    revisionRows += rows.filter((row) => row.requiere_revision === "SI").length;
  });
  return {
    tables,
    validations,
    summary: {
      total_tables: 4,
      total_rows: totalRows,
      total_warnings: totalWarnings,
      requiere_revision_rows: revisionRows,
      total_apoyos_marcados: tables[TABLE_NAMES.apoyos].filter((row) => row.seleccionado === "SI").length,
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

module.exports = { TABLE_NAMES, buildTables, validateRows, flattenWarnings };
