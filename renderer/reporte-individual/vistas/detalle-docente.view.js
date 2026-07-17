/* =========================================================
Nombre completo: detalle-docente.view.js
Ruta: /renderer/reporte-individual/vistas/detalle-docente.view.js
Función: Renderizar el detalle completo del Reporte Individual.
========================================================= */
"use strict";

window.IndividualReportViews = window.IndividualReportViews || {};
window.IndividualReportViews.renderTeacherDetail = function renderTeacherDetail(container, report) {
  const components = window.IndividualReportComponents;
  if (!container) return;
  if (!report) {
    container.innerHTML = '<div class="empty">Selecciona un docente para revisar su reporte.</div>';
    return;
  }
  container.innerHTML = `
    ${components.renderTeacherSummary(report)}
    <div class="status-box ${report.puedeGenerar ? "status-success" : "status-danger"}">
      ${report.puedeGenerar
        ? "El reporte puede prepararse porque existen el Plan Individual y los acuerdos requeridos."
        : "El reporte no puede prepararse hasta completar el Plan Individual y todos los acuerdos requeridos."}
    </div>
    <h3>Capacitaciones y comprobación documental</h3>
    ${components.renderTrainings(report.capacitaciones)}
    <h3>Alertas generales</h3>
    ${components.renderAlerts(report.alerts)}`;
};
