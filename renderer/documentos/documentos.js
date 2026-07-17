/* =========================================================
Nombre completo: documentos.js
Ruta o ubicación: /renderer/documentos/documentos.js
Función o funciones:
- Controlar seis secciones documentales sin mezclar sus estados.
- Mostrar validación, OCR, resultados, guardado y exportación.
- Cargar PDF individuales o buscar PDF dentro de carpetas con rutas largas.
========================================================= */
"use strict";

(function initializeDocumentsPage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  const sections = windowObject.DocumentSections || {};
  const states = Object.fromEntries(Object.keys(sections).map((id) => [id, {
    filePaths: [],
    validation: null,
    outputDir: "",
    result: null,
    busy: false
  }]));
  let activeType = "plan-individual";

  const elements = {
    tabs: [...documentObject.querySelectorAll("[data-document-tab]")],
    title: documentObject.getElementById("workspaceTitle"),
    description: documentObject.getElementById("workspaceDescription"),
    code: documentObject.getElementById("workspaceCode"),
    select: documentObject.getElementById("btnSelectDocuments"),
    selectFolder: documentObject.getElementById("btnSelectDocumentFolder"),
    validate: documentObject.getElementById("btnValidateDocuments"),
    output: documentObject.getElementById("btnChooseOutput"),
    generate: documentObject.getElementById("btnGenerateDocuments"),
    clear: documentObject.getElementById("btnClearDocuments"),
    status: documentObject.getElementById("documentStatus"),
    outputStatus: documentObject.getElementById("outputStatus"),
    selected: documentObject.getElementById("selectedDocuments"),
    result: documentObject.getElementById("documentResult"),
    selectedCount: documentObject.getElementById("summarySelected"),
    validCount: documentObject.getElementById("summaryValid"),
    invalidCount: documentObject.getElementById("summaryInvalid"),
    digitalCount: documentObject.getElementById("summaryDigital"),
    ocrCount: documentObject.getElementById("summaryOcr"),
    ready: documentObject.getElementById("summaryReady"),
    progressPanel: documentObject.getElementById("ocrProgressPanel"),
    progressTitle: documentObject.getElementById("ocrProgressTitle"),
    progressDetail: documentObject.getElementById("ocrProgressDetail"),
    progressBar: documentObject.getElementById("ocrProgressBar")
  };

  function state() { return states[activeType]; }
  function config() { return sections[activeType]; }
  function setStatus(message, type = "info") {
    elements.status.className = ui.statusClass(type);
    elements.status.textContent = message;
  }
  function setOutputStatus(message, type = "info") {
    elements.outputStatus.className = ui.statusClass(type);
    elements.outputStatus.textContent = message;
  }
  function setProgress(payload = {}) {
    if (!payload.visible) {
      elements.progressPanel.classList.add("hidden");
      elements.progressBar.style.width = "0%";
      return;
    }
    elements.progressPanel.classList.remove("hidden");
    elements.progressTitle.textContent = payload.title || "Escaneando documento...";
    elements.progressDetail.textContent = payload.detail || "Procesando páginas.";
    const percent = Math.max(0, Math.min(Number(payload.percent || 0), 100));
    elements.progressBar.style.width = `${percent}%`;
  }

  function pathKey(filePath) {
    return String(filePath || "").replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "").replace(/\//g, "\\").toLowerCase();
  }

  function mergeFilePaths(currentPaths, incomingPaths) {
    const output = [];
    const seen = new Set();
    [...(currentPaths || []), ...(incomingPaths || [])].forEach((filePath) => {
      const cleanPath = String(filePath || "").trim();
      const key = pathKey(cleanPath);
      if (!cleanPath || seen.has(key)) return;
      seen.add(key);
      output.push(cleanPath);
    });
    return output;
  }

  function resetAfterSelection(current) {
    current.validation = null;
    current.result = null;
    updateSummary();
    updateButtons();
    renderFiles();
    renderResult();
  }

  function updateButtons() {
    const current = state();
    const hasFiles = current.filePaths.length > 0;
    elements.select.disabled = current.busy;
    elements.selectFolder.disabled = current.busy;
    elements.validate.disabled = !hasFiles || current.busy;
    elements.output.disabled = current.busy;
    elements.generate.disabled = !current.validation?.canContinue || !current.outputDir || current.busy;
    elements.clear.disabled = (!hasFiles && !current.outputDir && !current.result) || current.busy;
    elements.generate.textContent = current.busy ? "Procesando..." : "Escanear, guardar y generar";
  }

  function updateSummary() {
    const current = state();
    const validation = current.validation || {};
    elements.selectedCount.textContent = String(validation.total ?? current.filePaths.length);
    elements.validCount.textContent = String(validation.validCount || 0);
    elements.invalidCount.textContent = String(validation.invalidCount || 0);
    elements.digitalCount.textContent = String(validation.digitalCount || 0);
    elements.ocrCount.textContent = String((validation.ocrCount || 0) + (validation.mixedCount || 0));
    elements.ready.textContent = validation.canContinue ? "Sí" : "No";
  }

  function renderFiles() {
    const current = state();
    if (current.validation?.files?.length) {
      const rows = current.validation.files.map((file, index) => `<tr>
        <td>${index + 1}</td>
        <td>${ui.escapeHtml(file.name)}</td>
        <td>${ui.escapeHtml(file.detectedType || "No identificado")}</td>
        <td>${ui.escapeHtml(file.pageCount || 0)}</td>
        <td>${ui.escapeHtml(file.extractionMethod || "")}</td>
        <td>${ui.escapeHtml(file.ocrConfidence || 0)}%</td>
        <td>${ui.badge(file.valid ? "Válido" : "Revisar")}</td>
        <td>${ui.escapeHtml((file.errors || []).join(" | ") || (file.warnings || []).join(" | ") || "Listo para procesar.")}</td>
      </tr>`).join("");
      elements.selected.innerHTML = `<div class="table-scroll"><table><thead><tr>
        <th>#</th><th>Archivo</th><th>Tipo detectado</th><th>Páginas</th><th>Lectura</th><th>Confianza OCR</th><th>Estado</th><th>Observación</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
      return;
    }

    if (!current.filePaths.length) {
      elements.selected.innerHTML = '<div class="empty">Aquí aparecerán los PDF seleccionados.</div>';
      return;
    }

    const rows = current.filePaths.map((filePath, index) => `<tr>
      <td>${index + 1}</td><td>${ui.escapeHtml(ui.fileName(filePath))}</td>
      <td>${ui.escapeHtml(filePath)}</td><td>${ui.badge("Pendiente")}</td>
    </tr>`).join("");
    elements.selected.innerHTML = `<div class="table-scroll"><table><thead><tr><th>#</th><th>Archivo</th><th>Ruta</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderResult() {
    const result = state().result;
    if (!result) { elements.result.innerHTML = ""; return; }
    if (!result.ok) {
      elements.result.innerHTML = `<div class="status-box status-danger">${ui.escapeHtml(result.message || "No se pudo procesar.")}</div>`;
      return;
    }
    const persistence = result.persistence || {};
    const tableRows = Object.entries(result.summary?.rows_by_table || {}).map(([name, count]) => `<tr><td>${ui.escapeHtml(name)}</td><td>${ui.escapeHtml(count)}</td></tr>`).join("");
    elements.result.innerHTML = `
      <div class="status-box status-success">Proceso terminado correctamente.</div>
      <div class="result-files">
        <strong>Excel:</strong> ${ui.escapeHtml(result.files?.excel?.filePath || "")}<br>
        <strong>JSON:</strong> ${ui.escapeHtml(result.files?.json?.filePath || "")}<br>
        <strong>Documentos nuevos:</strong> ${ui.escapeHtml(persistence.documentsSaved || 0)}<br>
        <strong>Duplicados omitidos:</strong> ${ui.escapeHtml(persistence.duplicateDocumentsSkipped || 0)}<br>
        <strong>Filas guardadas:</strong> ${ui.escapeHtml(persistence.rowsSaved || 0)}<br>
        <strong>Páginas OCR:</strong> ${ui.escapeHtml(result.readResult?.ocrCount || 0)} documento(s) con OCR
      </div>
      <div class="table-scroll"><table><thead><tr><th>Tabla</th><th>Filas</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
  }

  function renderActiveSection() {
    const currentConfig = config();
    const current = state();
    elements.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.documentTab === activeType));
    elements.title.textContent = currentConfig.label;
    elements.description.textContent = currentConfig.description;
    elements.code.textContent = currentConfig.code;
    elements.select.textContent = currentConfig.selectLabel;
    setStatus(current.validation
      ? `Validación disponible: ${current.validation.validCount || 0} documento(s) válido(s).`
      : current.filePaths.length
        ? `${current.filePaths.length} documento(s) pendiente(s) de validación.`
        : `Esperando PDF para ${currentConfig.shortLabel}.`,
    current.validation?.canContinue ? "success" : "info");
    setOutputStatus(current.outputDir ? `Carpeta seleccionada: ${current.outputDir}` : "Carpeta de salida no seleccionada.", current.outputDir ? "success" : "info");
    updateSummary();
    updateButtons();
    renderFiles();
    renderResult();
    setProgress({ visible: false });
  }

  async function selectFiles() {
    try {
      const result = await windowObject.documentAppAPI.selectDocumentFiles(activeType);
      if (result.canceled) return;
      const current = state();
      const previousCount = current.filePaths.length;
      current.filePaths = mergeFilePaths(current.filePaths, Array.isArray(result.filePaths) ? result.filePaths : []);
      const added = current.filePaths.length - previousCount;
      resetAfterSelection(current);
      setStatus(`Se agregaron ${added} PDF. Total seleccionado: ${current.filePaths.length}. Ejecuta la validación.`, current.filePaths.length ? "success" : "warning");
    } catch (error) {
      setStatus(`No se pudieron seleccionar archivos: ${error.message}`, "danger");
    }
  }

  async function selectFolder() {
    try {
      const result = await windowObject.documentAppAPI.selectDocumentFolder(activeType);
      if (result.canceled) return;
      const current = state();
      const previousCount = current.filePaths.length;
      current.filePaths = mergeFilePaths(current.filePaths, Array.isArray(result.filePaths) ? result.filePaths : []);
      const added = current.filePaths.length - previousCount;
      resetAfterSelection(current);

      const inaccessible = Array.isArray(result.errors) ? result.errors.length : 0;
      const notes = [];
      if (result.truncated) notes.push(`Se alcanzó el límite de ${result.maxFiles || 5000} archivos.`);
      if (inaccessible) notes.push(`${inaccessible} carpeta(s) no pudieron leerse.`);
      const suffix = notes.length ? ` ${notes.join(" ")}` : "";
      setStatus(
        added
          ? `Se agregaron ${added} PDF desde la carpeta. Total seleccionado: ${current.filePaths.length}.${suffix}`
          : `No se agregaron PDF nuevos desde la carpeta seleccionada.${suffix}`,
        added ? (notes.length ? "warning" : "success") : "warning"
      );
    } catch (error) {
      setStatus(`No se pudo buscar PDF en la carpeta: ${error.message}`, "danger");
    }
  }

  async function validateFiles() {
    const current = state();
    current.busy = true;
    updateButtons();
    setStatus("Validando tipo documental. Se aplicará OCR breve si el PDF está escaneado...", "info");
    setProgress({ visible: true, title: "Validando documentos", detail: "Leyendo las primeras páginas.", percent: 5 });
    try {
      current.validation = await windowObject.documentAppAPI.validateDocumentFiles({
        documentType: activeType,
        filePaths: current.filePaths
      });
      if (!current.validation.canContinue) {
        setStatus("No existen documentos válidos para esta sección.", "danger");
      } else if (current.validation.invalidCount) {
        setStatus(`Validación terminada: ${current.validation.validCount} válido(s) y ${current.validation.invalidCount} para revisar.`, "warning");
      } else {
        setStatus(`Validación terminada: ${current.validation.validCount} documento(s) listo(s).`, "success");
      }
    } catch (error) {
      setStatus(`Error durante la validación: ${error.message}`, "danger");
    } finally {
      current.busy = false;
      setProgress({ visible: false });
      updateSummary(); updateButtons(); renderFiles();
    }
  }

  async function chooseOutput() {
    try {
      const result = await windowObject.documentAppAPI.chooseOutputDirectory();
      if (result.canceled) return;
      state().outputDir = result.outputDir || "";
      setOutputStatus(`Carpeta seleccionada: ${state().outputDir}`, "success");
      updateButtons();
    } catch (error) {
      setOutputStatus(`No se pudo seleccionar la carpeta: ${error.message}`, "danger");
    }
  }

  async function generate() {
    const current = state();
    if (!current.validation?.canContinue || !current.outputDir) return;
    current.busy = true;
    current.result = null;
    updateButtons(); renderResult();
    setStatus("Procesando documentos. El OCR puede tardar varios minutos...", "info");
    setProgress({ visible: true, title: "Procesando documentos", detail: "Preparando lectura.", percent: 2 });
    try {
      current.result = await windowObject.documentAppAPI.generateDocumentReport({
        documentType: activeType,
        filePaths: current.filePaths,
        outputDir: current.outputDir
      });
      if (!current.result.ok) {
        setStatus(current.result.message || "No se pudo completar el procesamiento.", "danger");
      } else {
        const review = Number(current.result.summary?.requiere_revision_rows || 0);
        setStatus(`Proceso completado. Registros para revisión: ${review}.`, review ? "warning" : "success");
      }
    } catch (error) {
      current.result = { ok: false, message: error.message };
      setStatus(`Error al procesar: ${error.message}`, "danger");
    } finally {
      current.busy = false;
      setProgress({ visible: false });
      updateButtons(); renderResult();
    }
  }

  function clearSection() {
    states[activeType] = { filePaths: [], validation: null, outputDir: "", result: null, busy: false };
    renderActiveSection();
  }

  function handleOcrProgress(payload) {
    if (!payload || payload.documentType !== activeType || !state().busy) return;
    const totalPages = Number(payload.totalPages || 0);
    const page = Number(payload.page || 0);
    const percent = totalPages ? Math.round((page / totalPages) * 100) : Number(payload.percent || 8);
    setProgress({
      visible: true,
      title: payload.phase === "validation" ? "Validando con OCR" : "Escaneando documento",
      detail: payload.message || (page ? `Página ${page} de ${totalPages || "?"}` : "Reconociendo texto."),
      percent
    });
  }

  function bindEvents() {
    elements.tabs.forEach((tab) => tab.addEventListener("click", () => {
      if (state().busy) return;
      activeType = tab.dataset.documentTab;
      renderActiveSection();
    }));
    elements.select.addEventListener("click", selectFiles);
    elements.selectFolder.addEventListener("click", selectFolder);
    elements.validate.addEventListener("click", validateFiles);
    elements.output.addEventListener("click", chooseOutput);
    elements.generate.addEventListener("click", generate);
    elements.clear.addEventListener("click", clearSection);
    if (typeof windowObject.documentAppAPI.onOcrProgress === "function") {
      windowObject.documentAppAPI.onOcrProgress(handleOcrProgress);
    }
  }

  function initialize() {
    bindEvents();
    renderActiveSection();
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);