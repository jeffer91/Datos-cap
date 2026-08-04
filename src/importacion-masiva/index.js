/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/importacion-masiva/index.js
Función o funciones:
- Exponer el servicio y analizadores de importación masiva.
========================================================= */
"use strict";

module.exports = {
  ...require("./path-context.parser"),
  ...require("./importacion-masiva.service")
};
