/* =========================================================
Nombre completo: capacitaciones.component.js
Ruta: /renderer/reporte-individual/componentes/capacitaciones.component.js
Función: Renderizar el desglose documental por capacitación.
========================================================= */
"use strict";

window.IndividualReportComponents = window.IndividualReportComponents || {};
window.IndividualReportComponents.renderTrainings = function renderTrainings(trainings) {
  const ui = window.AppUI;
  const components = window.IndividualReportComponents;
  const rows = Array.isArray(trainings) ? trainings : [];
  if (!rows.length) return '<div class="empty">El Plan Individual no contiene capacitaciones reconocidas.</div>';

  function check(label, item, requiresTeacher = false) {
    const status = components.documentStatusText(item, requiresTeacher);
    const score = item?.exists && Number.isFinite(Number(item.matchScore))
      ? `${Math.round(Number(item.matchScore) * 100)}% de coincidencia`
      : "Sin coincidencia";
    return `<div class="document-check">
      <span>${ui.escapeHtml(label)}</span>
      <strong>${ui.escapeHtml(status)}</strong>
      <small>${ui.escapeHtml(score)}</small>
    </div>`;
  }

  return rows.map((training) => `
    <article class="training-card">
      <div class="training-card-head">
        <h3>${ui.escapeHtml(training.nombre || "Capacitación sin nombre")}</h3>
        ${components.renderReportState(training.status)}
      </div>
      <div class="document-check-grid">
        ${check("Acuerdo de Patrocinio", training.agreement)}
        ${check("Planificación", training.planning)}
        ${check("Informe Final", training.finalReport, true)}
        ${check("Instrumento de Evaluación", training.evaluationInstrument, true)}
        ${check("Informe de Impacto", training.impactReport, true)}
      </div>
      <div class="training-alerts">${components.renderAlerts(training.alerts)}</div>
    </article>`).join("");
};
