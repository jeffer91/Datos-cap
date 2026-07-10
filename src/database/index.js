/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/database/index.js
Función o funciones:
- Exponer el motor de colecciones JSON.
- Exponer persistencia, versionado, historial, consultas y filtros.
- Mantener una entrada única para la base local de la aplicación.
========================================================= */

"use strict";

module.exports = {
  ...require("./local-database"),
  ...require("./persistence.service"),
  ...require("./query.service")
};
