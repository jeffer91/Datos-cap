/* =========================================================
Nombre completo: estado-documental.component.js
Ruta: /renderer/reporte-individual/componentes/estado-documental.component.js
Función: Renderizar estados generales y comprobaciones documentales.
========================================================= */
"use strict";

window.IndividualReportComponents = window.IndividualReportComponents || {};

window.IndividualReportComponents.renderReportState = function renderReportState(value) {
  const ui = window.AppUI;
  const state = String(value || "SIN_ESTADO").toUpperCase();
  const css = state === "COMPLETO" || state === "COMPLETA"
    ? "report-state-complete"
    : state === "NO_GENERABLE" || state === "FALTA_ACUERDO"
      ? "report-state-danger"
      : "report-state-warning";
  return `<span class="report-state ${css}">${ui.escapeHtml(state.replaceAll("_", " "))}</span>`;
};

window.IndividualReportComponents.documentStatusText = function documentStatusText(item, requiresTeacher) {
  if (!item?.exists) return "NO ENCONTRADO";
  if (!requiresTeacher) return item.matchLevel === "DUDOSA" ? "ENCONTRADO · REVISAR NOMBRE" : "ENCONTRADO";
  if (item.teacherPresent === true) return "DOCENTE ENCONTRADO";
  if (item.teacherPresent === false) return "DOCENTE NO ENCONTRADO";
  return "LISTA NO VERIFICABLE";
};
