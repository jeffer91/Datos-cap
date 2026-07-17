/* =========================================================
Nombre completo: alertas.component.js
Ruta: /renderer/reporte-individual/componentes/alertas.component.js
Función: Renderizar alertas de generación y comprobación documental.
========================================================= */
"use strict";

window.IndividualReportComponents = window.IndividualReportComponents || {};
window.IndividualReportComponents.renderAlerts = function renderAlerts(alerts) {
  const ui = window.AppUI;
  const rows = Array.isArray(alerts) ? alerts : [];
  if (!rows.length) return '<div class="status-box status-success">No existen alertas documentales.</div>';
  return `<div class="alert-list">${rows.map((alert) => `
    <div class="alert-item ${alert.level === "ERROR" ? "error" : ""}">${ui.escapeHtml(alert.message || "Alerta sin detalle")}</div>
  `).join("")}</div>`;
};
