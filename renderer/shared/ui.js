/* =========================================================
Nombre completo: ui.js
Ruta o ubicación: /renderer/shared/ui.js
Función o funciones:
- Exponer utilidades visuales compartidas por Documentos y Base.
========================================================= */
"use strict";

(function exposeUiUtilities(windowObject) {
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  function formatNumber(value) { return new Intl.NumberFormat("es-EC").format(Number(value || 0)); }
  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-EC", { dateStyle: "short", timeStyle: "short" }).format(date);
  }
  function statusClass(type) {
    return `status-box status-${["info", "success", "warning", "danger"].includes(type) ? type : "info"}`;
  }
  function badge(value) {
    const normalized = String(value || "").toUpperCase();
    const css = normalized.includes("ERROR") || normalized === "SI" ? "badge-error"
      : normalized.includes("REVIS") || normalized.includes("OCR") || normalized.includes("PEND") ? "badge-warning"
        : "badge-ok";
    return `<span class="badge ${css}">${escapeHtml(value || "Sin estado")}</span>`;
  }
  function fileName(filePath) { return String(filePath || "").split(/[\\/]/).pop(); }
  function renderGenericTable(container, records, options = {}) {
    const rows = Array.isArray(records) ? records : [];
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<div class="empty">${escapeHtml(options.emptyText || "No existen registros.")}</div>`;
      return;
    }
    const columns = options.columns || Object.keys(rows[0] || {}).slice(0, 12);
    const headers = columns.map((column) => `<th>${escapeHtml(options.labels?.[column] || column)}</th>`).join("");
    const body = rows.map((row) => `<tr>${columns.map((column) => {
      const value = row[column];
      return `<td>${options.badgeColumns?.includes(column) ? badge(value) : escapeHtml(value)}</td>`;
    }).join("")}</tr>`).join("");
    container.innerHTML = `<div class="table-scroll"><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  windowObject.AppUI = Object.freeze({
    escapeHtml,
    formatNumber,
    formatDate,
    statusClass,
    badge,
    fileName,
    renderGenericTable
  });
})(window);
