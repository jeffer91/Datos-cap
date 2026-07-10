/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/plan-individual/definition.js
Función o funciones:
- Definir la identidad y reglas del apartado Plan Individual.
- Declarar si admite varios archivos y las tablas que genera.
- Mantener nombres de hojas y prefijo de exportación en un solo lugar.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "plan-individual",
  label: "Plan Individual de Formación y Capacitación Docente",
  shortLabel: "Planes individuales",
  description: "Procesa varios planes individuales y genera cinco tablas con los campos variables de cada docente.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: true,
  status: "active",
  processorId: "legacy-plan-individual",
  fileNameHints: ["PRO-251"],
  reportPrefix: "reporte_plan_individual",
  tables: [
    { name: "archivos_plan_individual", sheet: "01_archivos" },
    { name: "identificacion_docente", sheet: "02_identificacion" },
    { name: "capacidades_docente", sheet: "03_capacidades" },
    { name: "capacitaciones_propuestas", sheet: "04_capacitaciones" },
    { name: "formacion_docente", sheet: "05_formacion" }
  ]
});
