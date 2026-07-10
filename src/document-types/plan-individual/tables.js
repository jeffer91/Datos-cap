/* =========================================================
Nombre completo: tables.js
Ruta o ubicación: /src/document-types/plan-individual/tables.js
Función o funciones:
- Construir las cinco tablas específicas del Plan Individual.
- Encapsular temporalmente los constructores existentes.
- Entregar una interfaz uniforme al procesador documental.
========================================================= */

"use strict";

const legacyTables = require("../../tables");

function buildTables(parseResultOrDocuments) {
  return legacyTables.buildAllTables(parseResultOrDocuments);
}

function flattenWarnings(validations) {
  return legacyTables.flattenValidationWarnings(validations);
}

module.exports = {
  TABLE_NAMES: legacyTables.TABLE_NAMES,
  buildTables,
  validateTables: legacyTables.validateAllTables,
  createSummary: legacyTables.createTablesSummary,
  flattenWarnings
};
