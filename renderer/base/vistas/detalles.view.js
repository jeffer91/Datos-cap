/* =========================================================
Nombre completo: detalles.view.js
Ruta o ubicación: /renderer/base/vistas/detalles.view.js
Función o funciones:
- Seleccionar un documento almacenado.
- Mostrar todas sus tablas relacionadas mediante id_documento.
========================================================= */
"use strict";

window.BaseViews = window.BaseViews || {};
window.BaseViews.detalles = function renderDetalles(container, payload) {
  const ui = window.AppUI;
  const documents = payload?.documents || [];
  if (!documents.length) {
    container.innerHTML = '<div class="empty">Todavía no existen documentos guardados.</div>';
    return;
  }

  const options = documents.map((document) => `
    <option value="${ui.escapeHtml(document.id_documento || document.id)}">
      ${ui.escapeHtml(document.nombre_tipo_documental)} · ${ui.escapeHtml(document.nombre_archivo)}
    </option>`).join("");

  container.innerHTML = `
    <div class="detail-picker">
      <label for="detailDocumentSelect"><strong>Documento</strong></label>
      <select id="detailDocumentSelect">${options}</select>
    </div>
    <div id="detailDocumentContent"><div class="empty">Consultando detalles...</div></div>`;

  const select = container.querySelector("#detailDocumentSelect");
  const content = container.querySelector("#detailDocumentContent");

  async function loadDetails() {
    const documentId = select.value;
    content.innerHTML = '<div class="empty">Consultando registros relacionados...</div>';
    try {
      const result = await window.documentAppAPI.queryDatabaseDocumentDetails(documentId);
      const metadata = result.document || {};
      const collections = result.collections || {};
      const sections = Object.entries(collections)
        .filter(([, rows]) => Array.isArray(rows) && rows.length)
        .map(([name, rows], index) => `
          <section class="detail-section">
            <h3>${ui.escapeHtml(name)}</h3>
            <div id="detailTable${index}"></div>
          </section>`).join("");

      content.innerHTML = `
        <div class="detail-header">
          <h2>${ui.escapeHtml(metadata.nombre_archivo || "Documento")}</h2>
          <p>${ui.escapeHtml(metadata.nombre_tipo_documental || "")} · ${ui.escapeHtml(metadata.codigo_documento || "Sin código")}</p>
        </div>
        ${sections || '<div class="empty">No se encontraron tablas relacionadas.</div>'}`;

      Object.entries(collections)
        .filter(([, rows]) => Array.isArray(rows) && rows.length)
        .forEach(([, rows], index) => {
          ui.renderGenericTable(content.querySelector(`#detailTable${index}`), rows, {
            columns: Object.keys(rows[0]).filter((key) => !key.startsWith("_")).slice(0, 18),
            emptyText: "Sin registros."
          });
        });
    } catch (error) {
      content.innerHTML = `<div class="empty">${ui.escapeHtml(error.message)}</div>`;
    }
  }

  select.addEventListener("change", loadDetails);
  loadDetails();
};
