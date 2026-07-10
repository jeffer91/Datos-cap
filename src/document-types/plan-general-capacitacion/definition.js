/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/plan-general-capacitacion/definition.js
Función o funciones:
- Definir el documento único Plan Semestral de Capacitación Docente.
- Limitar su carga a un archivo por operación y periodo.
- Establecer ocho tablas para planificación, ejecución y seguimiento.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "plan-general-capacitacion",
  label: "Plan Semestral de Capacitación Docente",
  shortLabel: "Plan de capacitación",
  description: "Documento institucional único por periodo que organiza objetivos, capacitaciones, cronograma, indicadores, recursos y responsables.",
  mode: "unique-period",
  allowMultiple: false,
  uniquePerPeriod: true,
  enabled: true,
  status: "active",
  processorId: "plan-general-capacitacion",
  fileNameHints: ["UGPA-RGI2", "PRO-70"],
  reportPrefix: "reporte_plan_general_capacitacion",
  tables: [
    { name: "archivos_plan_general_capacitacion", sheet: "01_archivos" },
    { name: "datos_plan_general_capacitacion", sheet: "02_datos_generales" },
    { name: "objetivos_plan_general_capacitacion", sheet: "03_objetivos" },
    { name: "capacitaciones_planificadas", sheet: "04_capacitaciones" },
    { name: "cronograma_plan_general_capacitacion", sheet: "05_cronograma" },
    { name: "seguimiento_plan_general_capacitacion", sheet: "06_seguimiento" },
    { name: "recursos_plan_general_capacitacion", sheet: "07_recursos" },
    { name: "responsables_plan_general_capacitacion", sheet: "08_responsables" }
  ]
});
