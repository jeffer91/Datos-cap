/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/planificacion-capacitacion/index.js
Función o funciones:
- Exponer definición, parser, tablas y validador del módulo.
========================================================= */
"use strict";

module.exports = {
  definition: require("./definition"),
  parser: require("./parser"),
  tables: require("./tables"),
  validator: require("./validator")
};
