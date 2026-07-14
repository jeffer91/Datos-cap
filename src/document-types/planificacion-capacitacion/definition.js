/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/planificacion-capacitacion/definition.js
Función o funciones:
- Definir el tipo documental Planificación de Capacitación.
- Declarar códigos esperados, carga múltiple y tablas de salida.
========================================================= */
"use strict";

module.exports = Object.freeze({
  id: "planificacion-capacitacion",
  label: "Planificación de Capacitación",
  shortLabel: "Planificaciones",
  description: "Procesa planificaciones por curso mediante lectura digital u OCR.",
  allowMultiple: true,
  fileNameHints: ["RGI1", "PRO-134"],
  reportPrefix: "reporte_planificaciones_capacitacion",
  tables: [
    { name: "archivos_planificacion_capacitacion", sheet: "01_archivos" },
    { name: "datos_planificacion_capacitacion", sheet: "02_datos" },
    { name: "temario_planificacion_capacitacion", sheet: "03_temario" },
    { name: "evaluaciones_planificacion_capacitacion", sheet: "04_evaluaciones" },
    { name: "responsables_planificacion_capacitacion", sheet: "05_responsables" },
    { name: "facilitadores_planificacion_capacitacion", sheet: "06_facilitadores" },
    { name: "anexos_planificacion_capacitacion", sheet: "07_anexos" },
    { name: "ocr_paginas_planificacion", sheet: "08_ocr_paginas" }
  ]
});
