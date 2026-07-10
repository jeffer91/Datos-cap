/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/planificacion-curso/definition.js
Función o funciones:
- Definir el apartado de Planificación de Capacitación por curso.
- Declarar sus cuatro tablas y reglas de carga múltiple.
- Activar su procesador especializado con lectura digital y OCR.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "planificacion-curso",
  label: "Planificación de Capacitación por Curso",
  shortLabel: "Planificaciones por curso",
  description: "Procesa planificaciones por curso y genera archivos, datos generales, unidades y evaluaciones.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: true,
  status: "active",
  processorId: "planificacion-curso",
  fileNameHints: ["RGI1", "PRO-134"],
  reportPrefix: "reporte_planificacion_curso",
  tables: [
    { name: "archivos_planificacion_curso", sheet: "01_archivos" },
    { name: "datos_generales_capacitacion", sheet: "02_datos_generales" },
    { name: "unidades_capacitacion", sheet: "03_unidades" },
    { name: "evaluaciones_capacitacion", sheet: "04_evaluaciones" }
  ]
});
