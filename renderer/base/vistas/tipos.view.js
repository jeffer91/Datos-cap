/* =========================================================
Nombre completo: tipos.view.js
Ruta o ubicación: /renderer/base/vistas/tipos.view.js
Función o funciones:
- Renderizar registros específicos del tipo documental seleccionado.
========================================================= */
"use strict";

window.BaseViews = window.BaseViews || {};
window.BaseViews.tipos = function renderTipos(container, payload) {
  const records = payload?.records || [];
  window.AppUI.renderGenericTable(container, records, {
    columns: records.length ? Object.keys(records[0]).filter((key) => !key.startsWith("_")).slice(0, 16) : [],
    emptyText: "No existen registros para el tipo documental seleccionado."
  });
};
