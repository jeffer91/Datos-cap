/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/definition.js
Función o funciones:
- Definir el apartado de Instrumentos de Evaluación de la Capacitación.
- Declarar sus reglas de carga repetitiva.
- Establecer ocho tablas para sus datos variables y resultados.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "instrumento-evaluacion",
  label: "Instrumento de Evaluación de la Capacitación",
  shortLabel: "Instrumentos de evaluación",
  description: "Procesa instrumentos PRO-135 y extrae participantes, indicadores, escala Likert, objetivos, conclusiones y responsables.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: true,
  status: "active",
  processorId: "instrumento-evaluacion",
  fileNameHints: ["UGPA-RGI1", "PRO-135"],
  reportPrefix: "reporte_instrumentos_evaluacion",
  tables: [
    { name: "archivos_instrumento_evaluacion", sheet: "01_archivos" },
    { name: "datos_instrumento_evaluacion", sheet: "02_datos_generales" },
    { name: "participantes_instrumento_evaluacion", sheet: "03_participantes" },
    { name: "indicadores_instrumento_evaluacion", sheet: "04_indicadores" },
    { name: "likert_instrumento_evaluacion", sheet: "05_likert" },
    { name: "objetivos_instrumento_evaluacion", sheet: "06_objetivos" },
    { name: "analisis_instrumento_evaluacion", sheet: "07_analisis" },
    { name: "responsables_instrumento_evaluacion", sheet: "08_responsables" }
  ]
});
