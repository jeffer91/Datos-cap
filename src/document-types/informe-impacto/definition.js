/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/informe-impacto/definition.js
Función o funciones:
- Definir el apartado de Informes de Impacto de la Capacitación.
- Declarar sus reglas de carga repetitiva.
- Reservar su esquema de tablas para el análisis documental específico.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "informe-impacto",
  label: "Informe de Impacto de la Capacitación",
  shortLabel: "Informes de impacto",
  description: "Procesará indicadores de impacto cualitativo y cuantitativo, hallazgos, recomendaciones y responsables.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: false,
  status: "pending-schema",
  processorId: "informe-impacto",
  fileNameHints: ["INF", "PRO-135"],
  reportPrefix: "reporte_informes_impacto",
  tables: []
});
