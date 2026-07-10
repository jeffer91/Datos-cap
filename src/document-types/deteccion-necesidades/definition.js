/* =========================================================
Nombre completo: definition.js
Ruta o ubicación: /src/document-types/deteccion-necesidades/definition.js
Función o funciones:
- Definir el documento único Detección de Necesidades de Capacitación.
- Limitar su carga a un archivo por operación y periodo.
- Preparar control de versiones para documentos institucionales extensos.
========================================================= */

"use strict";

module.exports = Object.freeze({
  id: "deteccion-necesidades",
  label: "Detección de Necesidades de Capacitación",
  shortLabel: "Detección de necesidades",
  description: "Documento institucional único por periodo que consolida necesidades, recurrencias y prioridades por carrera.",
  mode: "unique-period",
  allowMultiple: false,
  uniquePerPeriod: true,
  enabled: false,
  status: "pending-schema",
  processorId: "deteccion-necesidades",
  fileNameHints: ["RGI1", "PRO-70"],
  reportPrefix: "reporte_deteccion_necesidades",
  tables: []
});
