/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/informe-final/definition.js
Función o funciones:
- Definir el apartado de Informes Finales de Capacitación.
- Declarar sus reglas de carga repetitiva.
- Establecer las seis tablas que representan sus datos variables.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "informe-final",
  label: "Informe Final de Capacitación",
  shortLabel: "Informes finales",
  description: "Procesa informes finales y extrae datos del curso, participantes, certificados, resumen y responsables.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: true,
  status: "active",
  processorId: "informe-final",
  fileNameHints: ["UGPA-INF", "PRO-134"],
  reportPrefix: "reporte_informes_finales",
  tables: [
    { name: "archivos_informe_final", sheet: "01_archivos" },
    { name: "datos_informe_final", sheet: "02_datos_generales" },
    { name: "participantes_informe_final", sheet: "03_participantes" },
    { name: "resultados_informe_final", sheet: "04_resultados" },
    { name: "resumen_informe_final", sheet: "05_resumen" },
    { name: "responsables_informe_final", sheet: "06_responsables" }
  ]
});
