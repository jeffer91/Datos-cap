/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/database/index.js
Función o funciones:
- Exponer el motor de colecciones JSON y el servicio de persistencia.
- Mantener una entrada única para la base local de la aplicación.
========================================================= */

"use strict";

module.exports = {
  ...require("./local-database"),
  ...require("./persistence.service")
};
