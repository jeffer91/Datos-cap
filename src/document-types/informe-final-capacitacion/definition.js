/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/definition.js
Función o funciones:
- Definir el tipo documental Informe Final de Capacitación.
- Declarar identificación, carga múltiple y nueve tablas de salida.
========================================================= */
"use strict";

module.exports = Object.freeze({
  id: "informe-final-capacitacion",
  label: "Informe Final de Capacitación",
  shortLabel: "Informes Finales",
  description: "Procesa informes finales, participantes, certificados, responsables y anexos mediante lectura digital u OCR.",
  allowMultiple: true,
  fileNameHints: ["INF", "PRO-134"],
  reportPrefix: "reporte_informes_finales_capacitacion",
  tables: [
    { name: "archivos_informe_final", sheet: "01_archivos" },
    { name: "datos_generales_informe", sheet: "02_datos_generales" },
    { name: "objetivos_informe", sheet: "03_objetivos" },
    { name: "participantes_informe", sheet: "04_participantes" },
    { name: "certificados_informe", sheet: "05_certificados" },
    { name: "resumen_certificados_informe", sheet: "06_resumen_certificados" },
    { name: "responsables_informe", sheet: "07_responsables" },
    { name: "anexos_informe", sheet: "08_anexos" },
    { name: "ocr_paginas_informe", sheet: "09_ocr_paginas" }
  ]
});
