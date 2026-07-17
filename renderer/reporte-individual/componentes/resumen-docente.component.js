/* =========================================================
Nombre completo: resumen-docente.component.js
Ruta: /renderer/reporte-individual/componentes/resumen-docente.component.js
Función: Renderizar la identificación y resumen del docente seleccionado.
========================================================= */
"use strict";

window.IndividualReportComponents = window.IndividualReportComponents || {};
window.IndividualReportComponents.renderTeacherSummary = function renderTeacherSummary(report) {
  const ui = window.AppUI;
  const state = window.IndividualReportComponents.renderReportState;
  const teacher = report?.docente || {};
  return `
    <div class="panel-title">
      <div><h2>${ui.escapeHtml(teacher.nombre || "Docente sin nombre")}</h2><span>Reporte por docente y capacitación</span></div>
      ${state(report?.estadoGeneral)}
    </div>
    <div class="teacher-summary">
      <div class="teacher-summary-item"><span>Cédula</span><strong>${ui.escapeHtml(teacher.cedula || "No determinada")}</strong></div>
      <div class="teacher-summary-item"><span>Carrera</span><strong>${ui.escapeHtml(teacher.carrera || "No determinada")}</strong></div>
      <div class="teacher-summary-item"><span>Capacitaciones</span><strong>${ui.escapeHtml(report?.capacitaciones?.length || 0)}</strong></div>
      <div class="teacher-summary-item"><span>Puede generar</span><strong>${report?.puedeGenerar ? "Sí" : "No"}</strong></div>
    </div>`;
};
