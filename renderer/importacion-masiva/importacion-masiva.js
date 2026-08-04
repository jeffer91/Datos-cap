/* =========================================================
Nombre completo: importacion-masiva.js
Ruta o ubicación: /renderer/importacion-masiva/importacion-masiva.js
Función o funciones:
- Seleccionar y ejecutar el SCAN de una carpeta institucional completa.
- Mostrar el inventario clasificado y sus advertencias.
- Generar un PDF independiente con todo lo encontrado durante el SCAN.
- Procesar automáticamente los documentos compatibles por tipo.
========================================================= */
"use strict";

(function initializeMassImportPage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  const state = {
    folderPath: "",
    outputDir: "",
    batch: null,
    files: [],
    summary: {},
    scanReportFile: "",
    busyAction: ""
  };

  const elements = {
    selectRoot: documentObject.getElementById("btnSelectRoot"),
    scanRoot: documentObject.getElementById("btnScanRoot"),
    selectOutput: documentObject.getElementById("btnSelectOutput"),
    exportScanPdf: documentObject.getElementById("btnExportScanPdf"),
    processBatch: documentObject.getElementById("btnProcessBatch"),
    includeReview: documentObject.getElementById("includeReview"),
    rootStatus: documentObject.getElementById("rootStatus"),
    outputStatus: documentObject.getElementById("outputStatus"),
    scanReportStatus: documentObject.getElementById("scanReportStatus"),
    progressPanel: documentObject.getElementById("massProgressPanel"),
    progressTitle: documentObject.getElementById("massProgressTitle"),
    progressDetail: documentObject.getElementById("massProgressDetail"),
    progressBar: documentObject.getElementById("massProgressBar"),
    statusFilter: documentObject.getElementById("statusFilter"),
    typeFilter: documentObject.getElementById("typeFilter"),
    fileSearch: documentObject.getElementById("fileSearch"),
    files: documentObject.getElementById("massFiles"),
    periodSummary: documentObject.getElementById("periodSummary"),
    processingResultCard: documentObject.getElementById("processingResultCard"),
    processingResult: documentObject.getElementById("processingResult"),
    summaryTotal: documentObject.getElementById("summaryTotal"),
    summaryReady: documentObject.getElementById("summaryReady"),
    summaryReview: documentObject.getElementById("summaryReview"),
    summaryUnsupported: documentObject.getElementById("summaryUnsupported"),
    summaryEmpty: documentObject.getElementById("summaryEmpty"),
    summaryInaccessible: documentObject.getElementById("summaryInaccessible"),
    summaryDigital: documentObject.getElementById("summaryDigital"),
    summaryOcr: documentObject.getElementById("summaryOcr")
  };

  const STATUS_LABELS = Object.freeze({
    READY: "Listo",
    REVIEW: "Revisar",
    UNSUPPORTED: "No identificado",
    EMPTY: "Archivo vacío",
    INACCESSIBLE: "Inaccesible",
    PROCESSED: "Procesado",
    PROCESSING_ERROR: "Error"
  });

  function isBusy() { return Boolean(state.busyAction); }

  function setStatus(element, message, type = "info") {
    element.className = ui.statusClass(type);
    element.textContent = message;
  }

  function setProgress(visible, title = "", detail = "", percent = 0) {
    elements.progressPanel.classList.toggle("hidden", !visible);
    if (!visible) {
      elements.progressBar.style.width = "0%";
      return;
    }
    elements.progressTitle.textContent = title || "Procesando carpeta...";
    elements.progressDetail.textContent = detail || "Espere mientras se analizan los documentos.";
    elements.progressBar.style.width = `${Math.max(0, Math.min(100, Number(percent || 0)))}%`;
  }

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status || "Sin estado";
    const css = ["EMPTY", "INACCESSIBLE", "PROCESSING_ERROR"].includes(status)
      ? "badge-error"
      : ["REVIEW", "UNSUPPORTED"].includes(status)
        ? "badge-warning"
        : "badge-ok";
    return `<span class="badge ${css}">${ui.escapeHtml(label)}</span>`;
  }

  function updateButtons() {
    const ready = Number(state.summary.ready || 0);
    const review = Number(state.summary.review || 0);
    const processable = ready + (elements.includeReview.checked ? review : 0);
    const busy = isBusy();

    elements.selectRoot.disabled = busy;
    elements.scanRoot.disabled = !state.folderPath || busy;
    elements.selectOutput.disabled = busy;
    elements.exportScanPdf.disabled = !state.batch?.id || !state.outputDir || busy;
    elements.processBatch.disabled = !state.batch?.id || !state.outputDir || processable <= 0 || busy;

    elements.scanRoot.textContent = state.busyAction === "scan" ? "Ejecutando SCAN..." : "Ejecutar SCAN";
    elements.exportScanPdf.textContent = state.busyAction === "export" ? "Generando PDF..." : "Generar PDF del SCAN";
    elements.processBatch.textContent = state.busyAction === "process"
      ? "Procesando documentos..."
      : `Procesar documentos clasificados${processable ? ` (${processable})` : ""}`;
  }

  function renderSummary() {
    const summary = state.summary || {};
    elements.summaryTotal.textContent = String(summary.total || 0);
    elements.summaryReady.textContent = String(summary.ready || 0);
    elements.summaryReview.textContent = String(summary.review || 0);
    elements.summaryUnsupported.textContent = String(summary.unsupported || 0);
    elements.summaryEmpty.textContent = String(summary.empty || 0);
    elements.summaryInaccessible.textContent = String(summary.inaccessible || 0);
    elements.summaryDigital.textContent = String(summary.digital || 0);
    elements.summaryOcr.textContent = String(summary.ocr || 0);
    const periods = Array.isArray(summary.academicPeriods) ? summary.academicPeriods : [];
    elements.periodSummary.innerHTML = periods.length
      ? periods.map((period) => `<span class="period-chip">${ui.escapeHtml(period)}</span>`).join("")
      : "";
  }

  function filteredFiles() {
    const status = elements.statusFilter.value;
    const type = elements.typeFilter.value;
    const query = elements.fileSearch.value.trim().toLowerCase();
    return state.files.filter((file) => {
      if (status && file.status !== status) return false;
      if (type && file.detectedType !== type) return false;
      if (!query) return true;
      const haystack = [
        file.relativePath,
        file.path,
        file.detectedLabel,
        file.academicPeriod,
        file.processCode,
        file.documentFolder
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderFiles() {
    const rows = filteredFiles();
    if (!state.files.length) {
      elements.files.innerHTML = '<div class="empty">Aquí aparecerá el inventario clasificado de la carpeta.</div>';
      return;
    }
    if (!rows.length) {
      elements.files.innerHTML = '<div class="empty">No existen archivos que coincidan con los filtros seleccionados.</div>';
      return;
    }

    const body = rows.map((file, index) => {
      const confidence = Number(file.confidence || 0);
      const reasons = [...(file.reasons || []), ...(file.errors || [])].filter(Boolean).join(" ");
      return `<tr>
        <td>${index + 1}</td>
        <td><strong>${ui.escapeHtml(ui.fileName(file.path))}</strong><div class="file-path">${ui.escapeHtml(file.relativePath || file.path)}</div></td>
        <td>${ui.escapeHtml(file.processCode || "—")}</td>
        <td>${ui.escapeHtml(file.academicPeriod || "Sin periodo")}</td>
        <td>${ui.escapeHtml(file.detectedLabel || "No identificado")}</td>
        <td class="confidence-cell"><strong>${confidence}%</strong><div class="confidence-track"><div class="confidence-bar" style="width:${Math.max(0, Math.min(100, confidence))}%"></div></div></td>
        <td>${ui.escapeHtml(file.extractionMethod || "—")}</td>
        <td>${statusBadge(file.status)}</td>
        <td class="file-reasons">${ui.escapeHtml(reasons || "Clasificación sin advertencias.")}</td>
      </tr>`;
    }).join("");

    elements.files.innerHTML = `<div class="table-scroll"><table><thead><tr>
      <th>#</th><th>Archivo y ruta relativa</th><th>Proceso</th><th>Periodo académico</th><th>Tipo detectado</th><th>Confianza</th><th>Lectura</th><th>Estado</th><th>Explicación</th>
    </tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function renderResult(result) {
    elements.processingResultCard.classList.remove("hidden");
    if (!result?.ok) {
      elements.processingResult.innerHTML = `<div class="status-box status-danger">${ui.escapeHtml(result?.message || "No se pudo completar la importación.")}</div>`;
      return;
    }
    const groups = Object.entries(result.results || {}).map(([type, item]) => {
      const files = item?.files || {};
      const fileLines = Object.entries(files).map(([format, value]) => {
        const filePath = value?.filePath || value || "";
        return `<div><strong>${ui.escapeHtml(format.toUpperCase())}:</strong> ${ui.escapeHtml(filePath)}</div>`;
      }).join("");
      return `<div class="result-group">
        <h3>${ui.escapeHtml(type)}</h3>
        <div>${statusBadge(item?.ok ? "PROCESSED" : "PROCESSING_ERROR")} ${ui.escapeHtml(item?.message || "")}</div>
        <div class="result-files">${fileLines || "Sin archivos exportados."}</div>
      </div>`;
    }).join("");
    elements.processingResult.innerHTML = `
      <div class="status-box ${result.summary?.failed ? "status-warning" : "status-success"}">${ui.escapeHtml(result.message)}</div>
      <div class="summary-grid">
        <div class="summary-item"><span>Procesados</span><strong>${ui.escapeHtml(result.summary?.processed || 0)}</strong></div>
        <div class="summary-item"><span>Con error</span><strong>${ui.escapeHtml(result.summary?.failed || 0)}</strong></div>
        <div class="summary-item"><span>Documentos vinculados</span><strong>${ui.escapeHtml(result.metadata?.documentsUpdated || 0)}</strong></div>
        <div class="summary-item"><span>Filas enriquecidas</span><strong>${ui.escapeHtml(result.metadata?.relatedRowsUpdated || 0)}</strong></div>
      </div>
      ${groups}`;
  }

  async function selectRoot() {
    try {
      const result = await windowObject.documentAppAPI.selectMassImportFolder();
      if (result.canceled) return;
      state.folderPath = result.folderPath;
      state.batch = null;
      state.files = [];
      state.summary = {};
      state.scanReportFile = "";
      setStatus(elements.rootStatus, `Carpeta seleccionada: ${state.folderPath}`, "success");
      setStatus(elements.scanReportStatus, "Ejecuta el SCAN para habilitar el informe PDF.", "info");
      renderSummary();
      renderFiles();
      updateButtons();
    } catch (error) {
      setStatus(elements.rootStatus, `No se pudo seleccionar la carpeta: ${error.message}`, "danger");
    }
  }

  async function scanRoot() {
    state.busyAction = "scan";
    updateButtons();
    setProgress(true, "Ejecutando SCAN de la carpeta institucional", "Inventariando PDF y comprobando sus primeras páginas.", 2);
    setStatus(elements.rootStatus, "Analizando carpetas, nombres, contenido digital y OCR...", "info");
    try {
      const result = await windowObject.documentAppAPI.scanMassImportFolder({ folderPath: state.folderPath });
      if (!result.ok) throw new Error(result.message || "No se pudo analizar la carpeta.");
      state.batch = result.batch;
      state.files = result.files || [];
      state.summary = result.summary || {};
      state.scanReportFile = "";
      renderSummary();
      renderFiles();
      const warningCount = Number(state.summary.review || 0) + Number(state.summary.unsupported || 0) + Number(state.summary.empty || 0) + Number(state.summary.inaccessible || 0);
      setStatus(
        elements.rootStatus,
        warningCount
          ? `SCAN terminado. ${state.summary.ready || 0} documento(s) listos y ${warningCount} caso(s) que requieren atención.`
          : `SCAN terminado. ${state.summary.ready || 0} documento(s) listos para procesar.`,
        warningCount ? "warning" : "success"
      );
      setStatus(
        elements.scanReportStatus,
        state.outputDir
          ? "El SCAN está listo. Ya puedes generar el PDF completo."
          : "El SCAN está listo. Selecciona una carpeta de salida para generar el PDF.",
        "success"
      );
    } catch (error) {
      setStatus(elements.rootStatus, `Error durante el SCAN: ${error.message}`, "danger");
      setStatus(elements.scanReportStatus, "No se puede generar el PDF porque el SCAN no finalizó correctamente.", "danger");
    } finally {
      state.busyAction = "";
      setProgress(false);
      updateButtons();
    }
  }

  async function selectOutput() {
    try {
      const result = await windowObject.documentAppAPI.chooseOutputDirectory();
      if (result.canceled) return;
      state.outputDir = result.outputDir;
      setStatus(elements.outputStatus, `Carpeta de salida: ${state.outputDir}`, "success");
      if (state.batch?.id && !state.scanReportFile) {
        setStatus(elements.scanReportStatus, "El SCAN está listo. Ya puedes generar el PDF completo.", "success");
      }
      updateButtons();
    } catch (error) {
      setStatus(elements.outputStatus, `No se pudo seleccionar la salida: ${error.message}`, "danger");
    }
  }

  async function exportScanPdf() {
    state.busyAction = "export";
    updateButtons();
    setProgress(true, "Generando PDF del SCAN", "Construyendo resumen, inventario e incidencias.", 15);
    setStatus(elements.scanReportStatus, "Generando el PDF con todo lo escaneado...", "info");
    try {
      const result = await windowObject.documentAppAPI.exportMassImportScanReport({
        batchId: state.batch.id,
        outputDir: state.outputDir
      });
      if (!result?.ok) throw new Error(result?.message || "No se pudo generar el PDF del SCAN.");
      state.scanReportFile = result.filePath || "";
      setProgress(true, "Generando PDF del SCAN", "Finalizando el documento.", 95);
      setStatus(
        elements.scanReportStatus,
        `PDF generado correctamente: ${state.scanReportFile || result.fileName}`,
        "success"
      );
    } catch (error) {
      setStatus(elements.scanReportStatus, `No se pudo generar el PDF: ${error.message}`, "danger");
    } finally {
      state.busyAction = "";
      setProgress(false);
      updateButtons();
    }
  }

  async function processBatch() {
    state.busyAction = "process";
    updateButtons();
    setProgress(true, "Procesando documentos", "Cada tipo documental será enviado automáticamente a su procesador.", 2);
    try {
      const result = await windowObject.documentAppAPI.processMassImportBatch({
        batchId: state.batch.id,
        outputDir: state.outputDir,
        includeReview: elements.includeReview.checked
      });
      if (Array.isArray(result.files)) state.files = result.files;
      if (result.summary) state.summary = result.summary;
      if (result.batch) state.batch = result.batch;
      renderSummary();
      renderFiles();
      renderResult(result);
    } catch (error) {
      renderResult({ ok: false, message: error.message });
    } finally {
      state.busyAction = "";
      setProgress(false);
      updateButtons();
    }
  }

  elements.selectRoot.addEventListener("click", selectRoot);
  elements.scanRoot.addEventListener("click", scanRoot);
  elements.selectOutput.addEventListener("click", selectOutput);
  elements.exportScanPdf.addEventListener("click", exportScanPdf);
  elements.processBatch.addEventListener("click", processBatch);
  elements.includeReview.addEventListener("change", updateButtons);
  elements.statusFilter.addEventListener("change", renderFiles);
  elements.typeFilter.addEventListener("change", renderFiles);
  elements.fileSearch.addEventListener("input", renderFiles);

  windowObject.documentAppAPI.onOcrProgress((payload) => {
    if (payload?.documentType !== "importacion-masiva") return;
    const percent = Number.isFinite(payload.percent) ? payload.percent : 0;
    setProgress(
      true,
      payload.phase === "processing" ? "Procesando documentos" : "Ejecutando SCAN de la carpeta institucional",
      payload.message || "Procesando...",
      percent
    );
  });

  renderSummary();
  renderFiles();
  updateButtons();
})(window, document);
