/* =========================================================
Nombre completo: database.js
Ruta o ubicación: /renderer/database.js
Función o funciones:
- Consultar el resumen de la base local desde la interfaz.
- Mostrar documentos, filas, ejecuciones e historial reciente.
- Abrir la carpeta física de almacenamiento.
- Actualizar automáticamente el panel después de cada procesamiento.
========================================================= */

"use strict";

(function initializeDatabasePanel(windowObject, documentObject) {
  const elements = {
    documents: documentObject.getElementById("dbDocuments"),
    activeDocuments: documentObject.getElementById("dbActiveDocuments"),
    rows: documentObject.getElementById("dbRows"),
    runs: documentObject.getElementById("dbRuns"),
    status: documentObject.getElementById("databaseStatus"),
    history: documentObject.getElementById("databaseHistory"),
    refreshButton: documentObject.getElementById("btnRefreshDatabase"),
    openButton: documentObject.getElementById("btnOpenDatabase"),
    resultsContainer: documentObject.getElementById("resultsContainer")
  };

  let refreshing = false;
  let refreshTimer = null;

  function escapeHtml(value) {
    return String(value === null || typeof value === "undefined" ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setStatus(message, type = "info") {
    if (!elements.status) return;
    const allowed = new Set(["info", "success", "warning", "danger"]);
    const safeType = allowed.has(type) ? type : "info";
    elements.status.className = `status-box status-${safeType}`;
    elements.status.textContent = message;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("es-EC").format(Number(value || 0));
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "Sin fecha";
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function renderSummary(summary) {
    const data = summary || {};
    elements.documents.textContent = formatNumber(data.documentCount);
    elements.activeDocuments.textContent = formatNumber(data.activeDocumentCount);
    elements.rows.textContent = formatNumber(data.tableRows);
    elements.runs.textContent = formatNumber(data.processingRunCount);

    if (!data.ok) {
      setStatus(data.message || "No se pudo consultar la base local.", "danger");
      return;
    }

    setStatus(`Base local disponible en: ${data.databasePath}`, "success");
  }

  function statusBadge(status) {
    const normalized = String(status || "").toUpperCase();
    if (normalized === "COMPLETADO") return '<span class="badge badge-ok">Completado</span>';
    if (normalized.includes("ERROR")) return '<span class="badge badge-error">Con error</span>';
    return '<span class="badge badge-warning">Procesado localmente</span>';
  }

  function renderHistory(runs) {
    const list = Array.isArray(runs) ? runs : [];
    if (!list.length) {
      elements.history.innerHTML = '<div class="empty">Todavía no existen procesamientos registrados.</div>';
      return;
    }

    const rows = list.map((run) => `
      <tr>
        <td>${escapeHtml(formatDate(run.fecha_fin || run.fecha_inicio))}</td>
        <td>${escapeHtml(run.nombre_tipo_documental || run.tipo_documental)}</td>
        <td>${escapeHtml(run.documentos_guardados || 0)}</td>
        <td>${escapeHtml(run.documentos_duplicados_omitidos || 0)}</td>
        <td>${escapeHtml(run.filas_guardadas || 0)}</td>
        <td>${statusBadge(run.estado)}</td>
      </tr>
    `).join("");

    elements.history.innerHTML = `
      <div class="database-history-title">Procesamientos recientes</div>
      <div class="table-scroll database-history-table">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo documental</th>
              <th>Documentos nuevos</th>
              <th>Duplicados omitidos</th>
              <th>Filas guardadas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function refreshDatabasePanel() {
    if (refreshing || !windowObject.documentAppAPI) return;
    refreshing = true;
    if (elements.refreshButton) elements.refreshButton.disabled = true;
    setStatus("Actualizando información de la base local...", "info");

    try {
      const [summary, historyResult] = await Promise.all([
        windowObject.documentAppAPI.getDatabaseSummary(),
        windowObject.documentAppAPI.listRecentDatabaseRuns({ limit: 8 })
      ]);
      renderSummary(summary);
      renderHistory(historyResult && historyResult.ok ? historyResult.runs : []);
    } catch (error) {
      setStatus(`No se pudo consultar la base local: ${error.message}`, "danger");
    } finally {
      refreshing = false;
      if (elements.refreshButton) elements.refreshButton.disabled = false;
    }
  }

  async function openDatabaseFolder() {
    if (!windowObject.documentAppAPI) return;
    try {
      const result = await windowObject.documentAppAPI.openDatabaseFolder();
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "No se pudo abrir la carpeta.", "danger");
        return;
      }
      setStatus(`Carpeta abierta: ${result.databasePath}`, "success");
    } catch (error) {
      setStatus(`No se pudo abrir la carpeta: ${error.message}`, "danger");
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) windowObject.clearTimeout(refreshTimer);
    refreshTimer = windowObject.setTimeout(refreshDatabasePanel, 500);
  }

  function bindEvents() {
    if (elements.refreshButton) elements.refreshButton.addEventListener("click", refreshDatabasePanel);
    if (elements.openButton) elements.openButton.addEventListener("click", openDatabaseFolder);

    if (elements.resultsContainer && typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        if (elements.resultsContainer.textContent.includes("Reporte generado correctamente")) scheduleRefresh();
      });
      observer.observe(elements.resultsContainer, { childList: true, subtree: true, characterData: true });
    }
  }

  function initialize() {
    bindEvents();
    refreshDatabasePanel();
    windowObject.localDatabaseUI = Object.freeze({ refresh: refreshDatabasePanel });
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
