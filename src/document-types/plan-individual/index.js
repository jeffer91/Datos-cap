/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/plan-individual/index.js
Función o funciones:
- Centralizar definición, parser, tablas y validaciones del Plan Individual.
- Exponer un contrato uniforme para el registro de procesadores.
========================================================= */

"use strict";

const definition = require("./definition");
const parser = require("./parser");
const tables = require("./tables");
const validator = require("./validator");

module.exports = Object.freeze({
  id: definition.id,
  definition,
  parseDocuments: parser.parseDocuments,
  buildTables: tables.buildTables,
  flattenWarnings: tables.flattenWarnings,
  validateParseResult: validator.validateParseResult,
  validateTableResult: validator.validateTableResult
});
