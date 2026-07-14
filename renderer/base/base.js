/* =========================================================
Nombre completo: base.js
Ruta o ubicación: /renderer/base/base.js
Función o funciones:
- Controlar la página Base independiente.
- Consultar resumen, documentos, tipos, detalles y procesamientos.
========================================================= */
"use strict";

(function initializeBasePage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  const views = windowObject.BaseViews || {};
  let activeView = "resumen";
  let loading = false;

  const elements = {
    tabs: [...documentObject.querySelectorAll("[data-base-view]")],
    view: documentObject.getElementById("baseView"),
    status: documentObject.getElementById("baseStatus"),
    search: documentObject.getElementById("baseSearch"),
    type: documentObject.getElementById("baseDocumentType"),
    reviewOnly: documentObject.getElementById("baseReviewOnly"),
    apply: documentObject.getElementById("btnApplyBaseFilters"),
    refresh: documentObject.getElementById("btnRefreshBase"),
    open: documentObject.getElementById("btnOpenBaseFolder")
  };

  function setStatus(message, type = "info") {
    elements.status.className = ui.statusClass(type);
    elements.status.textContent = message;
  }
  function filters() {
    return {
      query: elements.search.value.trim(),
      documentType: elements.type.value,
      reviewOnly: elements.reviewOnly.checked,
      limit: 500
    };
  }
  function configureToolbar() {
    const summary = activeView === "resumen";
    elements.search.disabled = summary;
    elements.type.disabled = summary;
    elements.reviewOnly.disabled = summary || activeView !== "documentos";
    if (activeView === "tipos" && !elements.type.value) elements.type.value = "plan-individual";
  }

  async function loadView() {
    if (loading) return;
    loading = true;
    elements.refresh.disabled = true;
    elements.apply.disabled = true;
    elements.view.innerHTML = '<div class="empty">Consultando la base local...</div>';
    setStatus("Actualizando información...", "info");

    try {
      const currentFilters = filters();
      if (activeView === "resumen") {
        const data = await windowObject.documentAppAPI.getDatabaseOverview();
        views.resumen(elements.view, data);
      } else if (activeView === "documentos") {
        const result = await windowObject.documentAppAPI.queryDatabaseDocuments(currentFilters);
        views.documentos(elements.view, result.documents || []);
      } else if (activeView === "tipos") {
        const type = currentFilters.documentType || "plan-individual";
        const result = await windowObject.documentAppAPI.queryDatabaseTypeRecords(type, currentFilters);
        views.tipos(elements.view, result);
      } else if (activeView === "detalles") {
        const result = await windowObject.documentAppAPI.queryDatabaseDocuments(currentFilters);
        views.detalles(elements.view, { documents: result.documents || [] });
      } else if (activeView === "procesamientos") {
        const result = await windowObject.documentAppAPI.queryDatabaseRuns(currentFilters);
        views.procesamientos(elements.view, result.runs || []);
      }
      setStatus("Base local actualizada correctamente.", "success");
    } catch (error) {
      elements.view.innerHTML = `<div class="empty">${ui.escapeHtml(error.message)}</div>`;
      setStatus(`No se pudo consultar la base local: ${error.message}`, "danger");
    } finally {
      loading = false;
      elements.refresh.disabled = false;
      elements.apply.disabled = false;
    }
  }

  async function openFolder() {
    try {
      const result = await windowObject.documentAppAPI.openDatabaseFolder();
      setStatus(`Carpeta abierta: ${result.databasePath}`, "success");
    } catch (error) {
      setStatus(`No se pudo abrir la carpeta: ${error.message}`, "danger");
    }
  }

  function activateView(viewName) {
    activeView = viewName;
    elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.baseView === activeView));
    configureToolbar();
    loadView();
  }

  function bindEvents() {
    elements.tabs.forEach((tab) => tab.addEventListener("click", () => activateView(tab.dataset.baseView)));
    elements.apply.addEventListener("click", loadView);
    elements.refresh.addEventListener("click", loadView);
    elements.open.addEventListener("click", openFolder);
    elements.search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadView();
    });
    elements.type.addEventListener("change", () => {
      if (activeView === "tipos" || activeView === "detalles") loadView();
    });
  }

  function initialize() {
    bindEvents();
    configureToolbar();
    loadView();
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
