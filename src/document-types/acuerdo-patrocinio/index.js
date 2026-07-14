/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/index.js
Función o funciones:
- Exponer definición, parser, tablas y validación del módulo.
========================================================= */
"use strict";
module.exports = {
  definition: require("./definition"),
  parser: require("./parser"),
  tables: require("./tables"),
  validator: require("./validator")
};
