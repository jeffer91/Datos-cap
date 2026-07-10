/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/informe-impacto/definition.js
Función o funciones:
- Definir el apartado de Informes de Impacto de la Capacitación.
- Declarar sus reglas de carga repetitiva.
- Establecer siete tablas para los datos variables del informe.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "informe-impacto",
  label: "Informe de Impacto de la Capacitación",
  shortLabel: "Informes de impacto",
  description: "Procesa informes PRO-135 y extrae datos generales, indicadores cualitativos y cuantitativos, metodología, objetivos, análisis y responsables.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: true,
  status: "active",
  processorId: "informe-impacto",
  fileNameHints: ["UGPA-INF", "PRO-135"],
  reportPrefix: "reporte_informes_impacto",
  tables: [
    { name: "archivos_informe_impacto", sheet: "01_archivos" },
    { name: "datos_informe_impacto", sheet: "02_datos_generales" },
    { name: "indicadores_informe_impacto", sheet: "03_indicadores" },
    { name: "objetivos_informe_impacto", sheet: "04_objetivos" },
    { name: "metodologia_informe_impacto", sheet: "05_metodologia" },
    { name: "analisis_informe_impacto", sheet: "06_analisis" },
    { name: "responsables_informe_impacto", sheet: "07_responsables" }
  ]
});
