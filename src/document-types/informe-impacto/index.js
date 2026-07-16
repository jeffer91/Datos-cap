/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/informe-impacto/index.js
Función o funciones:
- Configurar el tipo documental Informe de Impacto.
- Exponer parser, tablas y validación provisional ajustable con documentos reales.
========================================================= */
"use strict";

const { buildFactory } = require("../seguimiento-capacitacion.factory");

module.exports = buildFactory({
  id: "informe-impacto",
  kind: "impact",
  label: "Informe de Impacto",
  shortLabel: "Informes de Impacto",
  description: "Procesa informes de impacto, indicadores, resultados, recomendaciones, participantes, responsables, anexos y páginas OCR.",
  processCode: "135",
  fileNameHints: ["INFORME", "IMPACTO", "PRO-135"],
  reportPrefix: "reporte_informes_impacto"
});
