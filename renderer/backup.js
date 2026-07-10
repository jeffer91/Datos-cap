/* =========================================================
Nombre completo: backup.js
Ruta o ubicación: /renderer/backup.js
Función o funciones:
- Mostrar el estado de los respaldos automáticos.
- Crear respaldos manuales completos.
- Restaurar archivos validados y refrescar base y consultas.
- Abrir la carpeta física de respaldos.
========================================================= */

"use strict";

(function initializeBackupPanel(windowObject, documentObject) {
  const elements = {
    countBadge: documentObject.getElementById("backupCountBadge"),
    lastDate: documentObject.getElementById("backupLastDate"),
    totalSize: documentObject.getElementById("backupTotalSize"),
    status: documentObject.getElementById("backupStatus"),
    createButton: documentObject.getElementById("btnCreateBackup"),
    restoreButton: documentObject.getElementById("btnRestoreBackup"),
    openButton: documentObject.getElementById("btnOpenBackups"),
    refreshButton: documentObject.getElementById("btnRefreshBackups"),
    processingResults: documentObject.getElementById("resultsContainer")
  };

  let busy = false;
  let refreshTimer = null;

  function setStatus(message, type = "info") {
    const allowed = new Set(["info", "success", "warning", "danger"]);
    const safeType = allowed.has(type) ? type : "info";
    elements.status.className = `status-box status-${safeType}`;
    elements.status.textContent = message;
  }

  function setBusy(value) {
    busy = Boolean(value);
    [elements.createButton, elements.restoreButton, elements.openButton, elements.refreshButton]
      .filter(Boolean)
      .forEach((button) => { button.disabled = busy; });
  }

  function formatDate(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "Sin respaldos";
    return new Intl.DateTimeFormat("es-EC", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  function refreshDependentPanels() {
    if (windowObject.localDatabaseUI && typeof windowObject.localDatabaseUI.refresh === "function") {
      windowObject.localDatabaseUI.refresh();
    }
    if (windowObject.localQueryUI) {
      if (typeof windowObject.localQueryUI.refreshOptions === "function") windowObject.localQueryUI.refreshOptions();
      if (typeof windowObject.localQueryUI.run === "function") windowObject.localQueryUI.run(1);
    }
  }

  async function refreshSummary() {
    if (busy || !windowObject.documentAppAPI) return;
    setBusy(true);
    setStatus("Consultando respaldos disponibles...", "info");

    try {
      const result = await windowObject.documentAppAPI.getBackupSummary();
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "No se pudo consultar los respaldos.", "danger");
        return;
      }

      const count = Number(result.automaticBackupCount || 0);
      elements.countBadge.textContent = `${count} respaldo${count === 1 ? "" : "s"}`;
      elements.lastDate.textContent = result.lastBackup ? formatDate(result.lastBackup.createdAt) : "Sin respaldos";
      elements.totalSize.textContent = formatBytes(result.totalSizeBytes);
      setStatus(`Respaldos automáticos disponibles en: ${result.backupDirectory}`, "success");
    } catch (error) {
      setStatus(`No se pudo consultar los respaldos: ${error.message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function createManualBackup() {
    if (busy || !windowObject.documentAppAPI) return;
    setBusy(true);
    setStatus("Preparando respaldo completo...", "info");

    try {
      const result = await windowObject.documentAppAPI.createManualBackup();
      if (result && result.canceled) {
        setStatus("Creación de respaldo cancelada.", "warning");
        return;
      }
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "No se pudo crear el respaldo.", "danger");
        return;
      }

      setStatus(
        `Respaldo creado: ${result.fileName}. Incluye ${result.collectionCount} colecciones y ${result.recordCount} registros.`,
        "success"
      );
      await refreshSummaryAfterBusy();
    } catch (error) {
      setStatus(`No se pudo crear el respaldo: ${error.message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function restoreBackup() {
    if (busy || !windowObject.documentAppAPI) return;
    setBusy(true);
    setStatus("Selecciona y valida el respaldo que deseas restaurar...", "info");

    try {
      const result = await windowObject.documentAppAPI.restoreBackup();
      if (result && result.canceled) {
        setStatus("Restauración cancelada. La base local no fue modificada.", "warning");
        return;
      }
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "No se pudo restaurar el respaldo.", "danger");
        return;
      }

      const mode = result.mode === "merge" ? "combinación" : "reemplazo";
      const documents = result.databaseSummary && result.databaseSummary.documentCount || 0;
      const rows = result.databaseSummary && result.databaseSummary.tableRows || 0;
      setStatus(
        `Restauración completada por ${mode}. La base contiene ${documents} documentos y ${rows} filas. Se creó un respaldo de seguridad previo.`,
        "success"
      );
      refreshDependentPanels();
      await refreshSummaryAfterBusy();
    } catch (error) {
      setStatus(`No se pudo restaurar el respaldo: ${error.message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function openBackupFolder() {
    if (busy || !windowObject.documentAppAPI) return;
    setBusy(true);

    try {
      const result = await windowObject.documentAppAPI.openBackupFolder();
      if (!result || !result.ok) {
        setStatus(result && result.message ? result.message : "No se pudo abrir la carpeta de respaldos.", "danger");
        return;
      }
      setStatus(`Carpeta abierta: ${result.backupDirectory}`, "success");
    } catch (error) {
      setStatus(`No se pudo abrir la carpeta: ${error.message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function refreshSummaryAfterBusy() {
    setBusy(false);
    await refreshSummary();
    setBusy(true);
  }

  function scheduleRefresh() {
    if (refreshTimer) windowObject.clearTimeout(refreshTimer);
    refreshTimer = windowObject.setTimeout(refreshSummary, 700);
  }

  function bindEvents() {
    elements.createButton.addEventListener("click", createManualBackup);
    elements.restoreButton.addEventListener("click", restoreBackup);
    elements.openButton.addEventListener("click", openBackupFolder);
    elements.refreshButton.addEventListener("click", refreshSummary);

    if (elements.processingResults && typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver(() => {
        if (elements.processingResults.textContent.includes("Reporte generado correctamente")) scheduleRefresh();
      });
      observer.observe(elements.processingResults, { childList: true, subtree: true, characterData: true });
    }
  }

  function initialize() {
    bindEvents();
    refreshSummary();
    windowObject.localBackupUI = Object.freeze({ refresh: refreshSummary });
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
