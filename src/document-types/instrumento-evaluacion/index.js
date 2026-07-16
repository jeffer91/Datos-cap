/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/index.js
Función o funciones:
- Configurar el tipo documental Instrumento de Evaluación.
- Exponer parser, tablas y validación provisional ajustable con documentos reales.
========================================================= */
"use strict";

const { buildFactory } = require("../seguimiento-capacitacion.factory");

module.exports = buildFactory({
  id: "instrumento-evaluacion",
  kind: "evaluation",
  label: "Instrumento de Evaluación",
  shortLabel: "Instrumentos de Evaluación",
  description: "Procesa instrumentos de evaluación, ítems, respuestas, resultados, responsables, anexos y páginas OCR.",
  processCode: "135",
  fileNameHints: ["INSTRUMENTO", "EVALUACION", "PRO-135"],
  reportPrefix: "reporte_instrumentos_evaluacion"
});
