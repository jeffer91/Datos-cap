/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/database/index.js
Función o funciones:
- Exponer motor, persistencia y consultas de la base local.
========================================================= */
"use strict";

module.exports = {
  ...require("./local-database"),
  ...require("./persistence.service"),
  ...require("./query.service")
};
