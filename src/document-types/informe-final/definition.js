/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/informe-final/definition.js
Función o funciones:
- Definir el apartado de Informes Finales de Capacitación.
- Declarar sus reglas de carga repetitiva.
- Reservar su esquema de tablas para el análisis documental específico.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "informe-final",
  label: "Informe Final de Capacitación",
  shortLabel: "Informes finales",
  description: "Procesará informes finales y sus listas de participantes, certificados, resultados y responsables.",
  mode: "repetitive",
  allowMultiple: true,
  uniquePerPeriod: false,
  enabled: false,
  status: "pending-schema",
  processorId: "informe-final",
  fileNameHints: ["INF", "PRO-134"],
  reportPrefix: "reporte_informes_finales",
  tables: []
});
