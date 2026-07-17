/* =========================================================
Nombre completo: listado-docentes.view.js
Ruta: /renderer/reporte-individual/vistas/listado-docentes.view.js
Función: Renderizar docentes disponibles en la base local.
========================================================= */
"use strict";

window.IndividualReportViews = window.IndividualReportViews || {};
window.IndividualReportViews.renderTeacherList = function renderTeacherList(container, teachers, selectedKey, onSelect) {
  const ui = window.AppUI;
  const components = window.IndividualReportComponents;
  const rows = Array.isArray(teachers) ? teachers : [];
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<div class="empty">No existen docentes con Plan Individual en la base.</div>';
    return;
  }

  container.innerHTML = `<div class="teacher-list">${rows.map((teacher) => `
    <button class="teacher-card ${teacher.key === selectedKey ? "active" : ""}" data-report-teacher-key="${ui.escapeHtml(teacher.key)}">
      <strong>${ui.escapeHtml(teacher.nombre)}</strong>
      <small>${ui.escapeHtml(teacher.cedula || "Cédula no determinada")} · ${ui.escapeHtml(teacher.carrera || "Sin carrera")}</small>
      <div class="teacher-card-footer">
        <small>${ui.escapeHtml(teacher.acuerdosEncontrados)} de ${ui.escapeHtml(teacher.totalCapacitaciones)} acuerdo(s)</small>
        ${components.renderReportState(teacher.estadoGeneral)}
      </div>
    </button>`).join("")}</div>`;

  container.querySelectorAll("[data-report-teacher-key]").forEach((button) => {
    button.addEventListener("click", () => onSelect(button.dataset.reportTeacherKey));
  });
};
