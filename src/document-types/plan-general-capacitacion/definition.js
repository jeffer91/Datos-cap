/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/plan-general-capacitacion/definition.js
Función o funciones:
- Definir el documento único Plan General de Capacitación Docente.
- Limitar su carga a un archivo por operación y periodo.
- Preparar control de versiones para documentos institucionales extensos.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "plan-general-capacitacion",
  label: "Plan General de Capacitación Docente",
  shortLabel: "Plan general de capacitación",
  description: "Documento institucional único por periodo que organiza capacitaciones, cronogramas, responsables y seguimiento.",
  mode: "unique-period",
  allowMultiple: false,
  uniquePerPeriod: true,
  enabled: false,
  status: "pending-schema",
  processorId: "plan-general-capacitacion",
  fileNameHints: ["RGI2", "PRO-70"],
  reportPrefix: "reporte_plan_general_capacitacion",
  tables: []
});
