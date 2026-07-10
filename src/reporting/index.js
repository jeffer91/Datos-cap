/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/reporting/index.js
Función o funciones:
- Exponer el esquema de fuentes para reportes.
- Exponer normalizadores de persona, curso, carrera y periodo.
- Exponer el repositorio que consolida la base local.
========================================================= */

"use strict";

module.exports = {
  ...require("./schema/reporting-schema.registry"),
  ...require("./normalization/text.normalizer"),
  ...require("./normalization/person.normalizer"),
  ...require("./normalization/course.normalizer"),
  ...require("./repositories/report-data.repository")
};
