/* =========================================================
Nombre completo: reporte-individual.exporter.js
Ruta o ubicación: /src/reporte-individual/reporte-individual.exporter.js
Función o funciones:
- Preparar el contenido estructurado del Reporte Individual.
- Mantener la salida lista para conectar la plantilla definitiva más adelante.
========================================================= */
"use strict";

function buildIndividualReportDraft(report, validation) {
  return {
    formato: "BORRADOR_ESTRUCTURADO",
    version: 1,
    generado_en: new Date().toISOString(),
    validacion: validation,
    docente: report.docente,
    plan_individual: report.planIndividual,
    puede_generar: report.puedeGenerar,
    estado_general: report.estadoGeneral,
    capacitaciones: report.capacitaciones,
    alertas: report.alerts
  };
}

module.exports = { buildIndividualReportDraft };
