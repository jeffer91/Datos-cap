/* =========================================================
Nombre completo: resumen.view.js
Ruta o ubicación: /renderer/base/vistas/resumen.view.js
Función o funciones:
- Renderizar el resumen general de la base local.
========================================================= */
"use strict";

window.BaseViews = window.BaseViews || {};
window.BaseViews.resumen = function renderResumen(container, data) {
  const ui = window.AppUI;
  const summary = data.summary || {};
  const cards = [
    ["Documentos", summary.documentCount],
    ["Planes Individuales", summary.planCount],
    ["Acuerdos", summary.agreementCount],
    ["Planificaciones", summary.planningCount],
    ["Informes Finales", summary.finalReportCount],
    ["Instrumentos de Evaluación", summary.evaluationInstrumentCount],
    ["Informes de Impacto", summary.impactReportCount],
    ["Filas almacenadas", summary.tableRows],
    ["Para revisión", summary.reviewCount],
    ["Páginas OCR", summary.ocrPageCount],
    ["Duplicados omitidos", summary.duplicateCount],
    ["Procesamientos", summary.processingRunCount],
    ["Confianza OCR promedio", `${summary.averageOcrConfidence || 0}%`]
  ];
  const cardsHtml = cards.map(([label, value]) => {
    const display = typeof value === "number" ? ui.formatNumber(value) : String(value == null ? "" : value);
    return `<div class="overview-card"><span>${ui.escapeHtml(label)}</span><strong>${ui.escapeHtml(display)}</strong></div>`;
  }).join("");
  container.innerHTML = `
    <div class="overview-grid">${cardsHtml}</div>
    <div class="database-path">Carpeta de la base: ${ui.escapeHtml(summary.databasePath || "No disponible")}</div>
    <div class="overview-sections">
      <section><h3>Últimos documentos</h3><div id="overviewDocuments"></div></section>
      <section><h3>Procesamientos recientes</h3><div id="overviewRuns"></div></section>
    </div>`;
  ui.renderGenericTable(container.querySelector("#overviewDocuments"), data.documents || [], {
    columns: ["fecha_registro", "nombre_tipo_documental", "nombre_archivo", "codigo_documento", "requiere_revision"],
    labels: { fecha_registro: "Fecha", nombre_tipo_documental: "Tipo", nombre_archivo: "Archivo", codigo_documento: "Código", requiere_revision: "Revisión" },
    badgeColumns: ["requiere_revision"],
    emptyText: "Todavía no existen documentos guardados."
  });
  ui.renderGenericTable(container.querySelector("#overviewRuns"), data.runs || [], {
    columns: ["fecha_fin", "nombre_tipo_documental", "documentos_guardados", "documentos_duplicados_omitidos", "filas_guardadas", "estado"],
    labels: { fecha_fin: "Fecha", nombre_tipo_documental: "Tipo", documentos_guardados: "Nuevos", documentos_duplicados_omitidos: "Duplicados", filas_guardadas: "Filas", estado: "Estado" },
    badgeColumns: ["estado"],
    emptyText: "Todavía no existen procesamientos."
  });
};
