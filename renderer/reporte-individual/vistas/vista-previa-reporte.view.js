/* =========================================================
Nombre completo: vista-previa-reporte.view.js
Ruta: /renderer/reporte-individual/vistas/vista-previa-reporte.view.js
Función: Mostrar el borrador estructurado antes de conectar la plantilla definitiva.
========================================================= */
"use strict";

window.IndividualReportViews = window.IndividualReportViews || {};
window.IndividualReportViews.renderReportPreview = function renderReportPreview(container, result) {
  const ui = window.AppUI;
  if (!container) return;
  if (!result) { container.innerHTML = ""; return; }
  if (!result.ok) {
    container.innerHTML = `<div class="report-preview"><div class="status-box status-danger">${ui.escapeHtml(result.message || "No se pudo preparar el reporte.")}</div></div>`;
    return;
  }
  container.innerHTML = `
    <div class="report-preview">
      <div class="status-box ${result.validation?.warnings?.length ? "status-warning" : "status-success"}">${ui.escapeHtml(result.message)}</div>
      <h3>Vista previa estructurada</h3>
      <p>La plantilla visual definitiva se conectará cuando se incorpore el formato institucional.</p>
      <pre>${ui.escapeHtml(JSON.stringify(result.draft, null, 2))}</pre>
    </div>`;
};
