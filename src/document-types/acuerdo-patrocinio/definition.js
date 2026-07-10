/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/definition.js
Función o funciones:
- Definir el apartado de Acuerdos de Patrocinio Institucional.
- Declarar sus reglas de carga repetitiva.
- Reservar su esquema de tablas para el análisis documental específico.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "acuerdo-patrocinio",
  label: "Acuerdo de Patrocinio Institucional",
  shortLabel: "Acuerdos de patrocinio",
  description: "Procesará acuerdos individuales y extraerá únicamente los datos variables del docente, capacitación y apoyo institucional.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: false,
  status: "pending-schema",
  processorId: "acuerdo-patrocinio",
  fileNameHints: [],
  reportPrefix: "reporte_acuerdos_patrocinio",
  tables: []
});
