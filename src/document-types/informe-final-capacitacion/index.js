/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/index.js
Función o funciones:
- Exponer definición, parsers, tablas y validación de Informes Finales.
========================================================= */
"use strict";

module.exports = {
  definition: require("./definition"),
  parser: require("./parser"),
  participantsParser: require("./participants.parser"),
  certificatesParser: require("./certificates.parser"),
  tables: require("./tables"),
  validator: require("./validator")
};
