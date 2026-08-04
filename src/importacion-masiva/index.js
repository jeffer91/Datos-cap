/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/importacion-masiva/index.js
Función o funciones:
- Exponer el servicio y analizadores de importación masiva.
- Exponer la generación del PDF institucional del SCAN.
========================================================= */
"use strict";

module.exports = {
  ...require("./path-context.parser"),
  ...require("./importacion-masiva.service"),
  ...require("./scan-report.exporter")
};
