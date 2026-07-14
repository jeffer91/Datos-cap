/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/definition.js
Función o funciones:
- Definir el tipo documental Acuerdo de Patrocinio Institucional.
- Declarar sus códigos esperados y sus cuatro tablas de salida.
========================================================= */
"use strict";

module.exports = Object.freeze({
  id: "acuerdo-patrocinio",
  label: "Acuerdo de Patrocinio Institucional",
  shortLabel: "Acuerdos de patrocinio",
  allowMultiple: true,
  fileNameHints: ["RGI2", "PRO-134"],
  reportPrefix: "reporte_acuerdos_patrocinio",
  tables: [
    { name: "archivos_acuerdo_patrocinio", sheet: "01_archivos" },
    { name: "datos_acuerdo_patrocinio", sheet: "02_datos_acuerdo" },
    { name: "apoyos_acuerdo_patrocinio", sheet: "03_apoyos" },
    { name: "responsables_acuerdo_patrocinio", sheet: "04_responsables" }
  ]
});
