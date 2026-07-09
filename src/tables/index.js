/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /plan-docente-extractor/src/tables/index.js
Función o funciones:
- Unificar la construcción de las cinco tablas no relacionales.
- Recibir el resultado del parser y devolver tablas listas para Excel y JSON.
- Ejecutar validaciones por tabla.
- Entregar resumen general de filas, alertas y estado de extracción.
========================================================= */

"use strict";

const archivosTable = require("./archivos.table");
const identificacionTable = require("./identificacion.table");
const capacidadesTable = require("./capacidades.table");
const capacitacionesTable = require("./capacitaciones.table");
const formacionTable = require("./formacion.table");

const TABLE_NAMES = {
  archivos: "archivos_plan_individual",
  identificacion: "identificacion_docente",
  capacidades: "capacidades_docente",
  capacitaciones: "capacitaciones_propuestas",
  formacion: "formacion_docente"
};

function getParsedDocuments(parseResultOrDocuments) {
  if (Array.isArray(parseResultOrDocuments)) {
    return parseResultOrDocuments;
  }

  if (parseResultOrDocuments && Array.isArray(parseResultOrDocuments.parsed)) {
    return parseResultOrDocuments.parsed;
  }

  return [];
}

function buildAllTables(parseResultOrDocuments) {
  const parsedDocuments = getParsedDocuments(parseResultOrDocuments);

  const tables = {
    [TABLE_NAMES.archivos]: archivosTable.buildArchivosTable(parsedDocuments),
    [TABLE_NAMES.identificacion]: identificacionTable.buildIdentificacionTable(parsedDocuments),
    [TABLE_NAMES.capacidades]: capacidadesTable.buildCapacidadesTable(parsedDocuments),
    [TABLE_NAMES.capacitaciones]: capacitacionesTable.buildCapacitacionesTable(parsedDocuments),
    [TABLE_NAMES.formacion]: formacionTable.buildFormacionTable(parsedDocuments)
  };

  const validations = validateAllTables(tables);
  const summary = createTablesSummary(tables, validations);

  return {
    tables,
    validations,
    summary
  };
}

function validateAllTables(tables) {
  const data = tables || {};

  return {
    [TABLE_NAMES.archivos]: archivosTable.validateArchivosTable(data[TABLE_NAMES.archivos]),
    [TABLE_NAMES.identificacion]: identificacionTable.validateIdentificacionTable(data[TABLE_NAMES.identificacion]),
    [TABLE_NAMES.capacidades]: capacidadesTable.validateCapacidadesTable(data[TABLE_NAMES.capacidades]),
    [TABLE_NAMES.capacitaciones]: capacitacionesTable.validateCapacitacionesTable(data[TABLE_NAMES.capacitaciones]),
    [TABLE_NAMES.formacion]: formacionTable.validateFormacionTable(data[TABLE_NAMES.formacion])
  };
}

function createTablesSummary(tables, validations) {
  const data = tables || {};
  const checks = validations || validateAllTables(data);
  const tableNames = Object.values(TABLE_NAMES);
  const rowsByTable = {};
  const warningsByTable = {};

  let totalRows = 0;
  let totalWarnings = 0;
  let requiereRevisionRows = 0;

  tableNames.forEach((tableName) => {
    const rows = Array.isArray(data[tableName]) ? data[tableName] : [];
    const validation = checks[tableName] || { warningCount: 0, warnings: [] };

    rowsByTable[tableName] = rows.length;
    warningsByTable[tableName] = validation.warningCount || 0;
    totalRows += rows.length;
    totalWarnings += validation.warningCount || 0;
    requiereRevisionRows += rows.filter((row) => row && row.requiere_revision === "SI").length;
  });

  return {
    total_tables: tableNames.length,
    total_rows: totalRows,
    total_warnings: totalWarnings,
    requiere_revision_rows: requiereRevisionRows,
    rows_by_table: rowsByTable,
    warnings_by_table: warningsByTable,
    estado_general: totalWarnings > 0 || requiereRevisionRows > 0 ? "REVISAR" : "OK"
  };
}

function flattenValidationWarnings(validations) {
  const checks = validations || {};
  const output = [];

  Object.keys(checks).forEach((tableName) => {
    const validation = checks[tableName];
    const warnings = validation && Array.isArray(validation.warnings) ? validation.warnings : [];

    warnings.forEach((warning) => {
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
  buildAllTables,
  validateAllTables,
  createTablesSummary,
  flattenValidationWarnings,
  archivosTable,
  identificacionTable,
  capacidadesTable,
  capacitacionesTable,
  formacionTable
};
