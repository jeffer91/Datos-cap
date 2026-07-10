/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/deteccion-necesidades/definition.js
Función o funciones:
- Definir el documento único Detección de Necesidades de Capacitación.
- Limitar su carga a un archivo por operación y periodo.
- Establecer nueve tablas para diagnóstico, evidencias y prioridades.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "deteccion-necesidades",
  label: "Detección de Necesidades de Capacitación",
  shortLabel: "Detección de necesidades",
  description: "Documento institucional único por periodo que consolida metodología, evidencias, necesidades institucionales, recurrencias y prioridades por carrera.",
  mode: "unique-period",
  allowMultiple: false,
  uniquePerPeriod: true,
  enabled: true,
  status: "active",
  processorId: "deteccion-necesidades",
  fileNameHints: ["UGPA-RGI1", "CGC-RGI1", "PRO-70"],
  reportPrefix: "reporte_deteccion_necesidades",
  tables: [
    { name: "archivos_deteccion_necesidades", sheet: "01_archivos" },
    { name: "datos_deteccion_necesidades", sheet: "02_datos_generales" },
    { name: "fuentes_deteccion_necesidades", sheet: "03_fuentes" },
    { name: "necesidades_institucionales", sheet: "04_institucionales" },
    { name: "necesidades_por_carrera", sheet: "05_necesidades_carrera" },
    { name: "prioridades_por_carrera", sheet: "06_prioridades_carrera" },
    { name: "consolidado_deteccion_necesidades", sheet: "07_consolidado" },
    { name: "analisis_deteccion_necesidades", sheet: "08_analisis" },
    { name: "responsables_deteccion_necesidades", sheet: "09_responsables" }
  ]
});
