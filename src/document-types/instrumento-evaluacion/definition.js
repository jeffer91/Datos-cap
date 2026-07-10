/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/definition.js
Función o funciones:
- Definir el apartado de Instrumentos de Evaluación de la Capacitación.
- Declarar sus reglas de carga repetitiva.
- Reservar su esquema de tablas para el análisis documental específico.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "instrumento-evaluacion",
  label: "Instrumento de Evaluación de la Capacitación",
  shortLabel: "Instrumentos de evaluación",
  description: "Procesará instrumentos con participantes, indicadores cuantitativos, resultados cualitativos y recomendaciones.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: false,
  status: "pending-schema",
  processorId: "instrumento-evaluacion",
  fileNameHints: ["RGI1", "PRO-135"],
  reportPrefix: "reporte_instrumentos_evaluacion",
  tables: []
});
