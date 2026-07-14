/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/database/index.js
Función o funciones:
- Exponer el motor y el servicio de persistencia de la base local.
========================================================= */
"use strict";
module.exports = {
  ...require("./local-database"),
  ...require("./persistence.service")
};
