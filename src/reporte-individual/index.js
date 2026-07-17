/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/reporte-individual/index.js
Función o funciones:
- Exponer todos los servicios y utilidades del Reporte Individual.
========================================================= */
"use strict";

module.exports = {
  ...require("./docente.matcher"),
  ...require("./capacitacion.matcher"),
  ...require("./reporte-individual.query"),
  ...require("./reporte-individual.rules"),
  ...require("./reporte-individual.builder"),
  ...require("./reporte-individual.validator"),
  ...require("./reporte-individual.exporter"),
  ...require("./reporte-individual.service")
};
