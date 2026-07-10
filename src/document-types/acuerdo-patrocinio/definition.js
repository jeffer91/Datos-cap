/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/definition.js
Función o funciones:
- Definir el apartado de Acuerdos de Patrocinio Institucional.
- Declarar sus reglas de carga repetitiva.
- Establecer las cuatro tablas que representan sus datos variables.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "acuerdo-patrocinio",
  label: "Acuerdo de Patrocinio Institucional",
  shortLabel: "Acuerdos de patrocinio",
  description: "Procesa acuerdos individuales y extrae datos del docente, capacitación, apoyos institucionales y responsables.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: true,
  status: "active",
  processorId: "acuerdo-patrocinio",
  fileNameHints: ["RGI2", "PRO-134"],
  reportPrefix: "reporte_acuerdos_patrocinio",
  tables: [
    { name: "archivos_acuerdo_patrocinio", sheet: "01_archivos" },
    { name: "datos_acuerdo_patrocinio", sheet: "02_datos_acuerdo" },
    { name: "apoyos_acuerdo_patrocinio", sheet: "03_apoyos" },
    { name: "responsables_acuerdo_patrocinio", sheet: "04_responsables" }
  ]
});
