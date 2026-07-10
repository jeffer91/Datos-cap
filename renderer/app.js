/* =========================================================
Nombre completo: app.js
Ruta o ubicación: /renderer/app.js
Función o funciones:
- Cargar y mostrar los ocho apartados documentales.
- Mantener un flujo independiente de selección por apartado.
- Validar PDF usando hash, reglas de multiplicidad y referencias esperadas.
- Generar Excel y JSON únicamente en módulos activos.
========================================================= */

"use strict";

const state = {
  documentTypes: [],
  activeType: null,
  selectedPaths: [],
  validation: null,
  outputDir: "",
  isGenerating: false,
  lastResult: null
};

const elements = {
  sectionList: document.getElementById("sectionList"),
  appVersion: document.getElementById("appVersion"),
  pageTitle: document.getElementById("pageTitle"),
  pageDescription: document.getElementById("pageDescription"),
  moduleRule: document.getElementById("moduleRule"),
  moduleMode: document.getElementById("moduleMode"),
  moduleStatusBadge: document.getElementById("moduleStatusBadge"),
  uploadDescription: document.getElementById("uploadDescription"),
  btnSelectPdf: document.getElementById("btnSelectPdf"),
  btnValidate: document.getElementById("btnValidate"),
  btnClear: document.getElementById("btnClear"),
  btnChooseOutput: document.getElementById("btnChooseOutput"),
  btnGenerate: document.getElementById("btnGenerate"),
  statusBox: document.getElementById("statusBox"),
  outputBox: document.getElementById("outputBox"),
  totalFiles: document.getElementById("totalFiles"),
  validFiles: document.getElementById("validFiles"),
  invalidFiles: document.getElementById("invalidFiles"),
  duplicateFiles: document.getElementById("duplicateFiles"),
  filesTableContainer: document.getElementById("filesTableContainer"),
  expectedTables: document.getElementById("expectedTables"),
  resultsContainer: document.getElementById("resultsContainer")
};

function hasBridge() {
  return Boolean(window.documentAppAPI);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, type = "info") {
  const validTypes = new Set(["info", "success", "warning", "danger"]);
  const safeType = validTypes.has(type) ? type : "info";
  elements.statusBox.className = `status-box status-${safeType}`;
  elements.statusBox.textContent = message;
}

function setOutputStatus(message, type = "info") {
  const validTypes = new Set(["info", "success", "warning", "danger"]);
  const safeType = validTypes.has(type) ? type : "info";
  elements.outputBox.className = `status-box status-${safeType}`;
  elements.outputBox.textContent = message;
}

function getStatusPresentation(definition) {
  if (definition && definition.enabled) {
    return { label: "Módulo activo", className: "badge badge-active" };
  }
  if (definition && definition.status === "structure-ready") {
    return { label: "Estructura preparada", className: "badge badge-ready" };
  }
  return { label: "Pendiente de tablas", className: "badge badge-pending" };
}

function getModeLabel(definition) {
  if (!definition) return "";
  if (definition.uniquePerPeriod) {
    return "Documento único por periodo. Solo admite un PDF por operación y conservará control de versiones.";
  }
  return definition.allowMultiple
    ? "Documento repetitivo. Permite cargar y comparar varios PDF del mismo tipo."
    : "Este apartado admite un solo PDF por operación.";
}

function renderSections() {
  if (!state.documentTypes.length) {
    elements.sectionList.innerHTML = '<div class="empty">No se encontraron apartados registrados.</div>';
    return;
  }

  elements.sectionList.innerHTML = state.documentTypes
    .map((definition) => {
      const activeClass = state.activeType && state.activeType.id === definition.id ? " is-active" : "";
      const status = getStatusPresentation(definition);
      const mode = definition.uniquePerPeriod ? "Único" : "Repetitivo";
      return `
        <button class="section-button${activeClass}" type="button" data-document-type="${escapeHtml(definition.id)}">
          <span class="section-button-title">${escapeHtml(definition.shortLabel)}</span>
          <span class="section-button-meta">
            <span>${escapeHtml(mode)}</span>
            <span class="${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
          </span>
        </button>
      `;
    })
    .join("");

  elements.sectionList.querySelectorAll("[data-document-type]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!state.isGenerating) selectDocumentType(button.dataset.documentType);
    });
  });
}

function renderExpectedTables() {
  const definition = state.activeType;
  const tables = definition && Array.isArray(definition.tables) ? definition.tables : [];

  if (!tables.length) {
    elements.expectedTables.innerHTML = `
      <div class="empty">
        Las tablas de este documento todavía deben definirse mediante comparación de archivos del mismo tipo.
      </div>
    `;
    return;
  }

  elements.expectedTables.innerHTML = tables
    .map((table, index) => `
      <div class="expected-table">
        <span>${index + 1}. ${escapeHtml(table.name)}</span>
        <strong>${escapeHtml(table.sheet)}</strong>
      </div>
    `)
    .join("");
}

function renderActiveType() {
  const definition = state.activeType;
  if (!definition) return;

  const status = getStatusPresentation(definition);
  elements.pageTitle.textContent = definition.label;
  elements.pageDescription.textContent = definition.description;
  elements.moduleRule.textContent = definition.uniquePerPeriod
    ? "Documento único por periodo"
    : "Documentos repetitivos del mismo tipo";
  elements.moduleMode.textContent = getModeLabel(definition);
  elements.moduleStatusBadge.className = status.className;
  elements.moduleStatusBadge.textContent = status.label;
  elements.uploadDescription.textContent = definition.enabled
    ? `Selecciona ${definition.allowMultiple ? "uno o varios PDF" : "un PDF"} correspondientes exclusivamente a este apartado.`
    : "El apartado está reservado en la nueva arquitectura. La carga se habilitará al incorporar su parser y sus tablas definitivas.";

  renderExpectedTables();
  renderSections();
}

function updateButtons() {
  const moduleEnabled = Boolean(state.activeType && state.activeType.enabled);
  const hasFiles = state.selectedPaths.length > 0;
  const canGenerate = Boolean(
    moduleEnabled &&
    state.validation &&
    state.validation.canContinue &&
    state.outputDir &&
    !state.isGenerating
  );

  elements.btnSelectPdf.disabled = !moduleEnabled || state.isGenerating;
  elements.btnValidate.disabled = !moduleEnabled || !hasFiles || state.isGenerating;
  elements.btnClear.disabled = !hasFiles || state.isGenerating;
  elements.btnChooseOutput.disabled = !moduleEnabled || state.isGenerating;
  elements.btnGenerate.disabled = !canGenerate;
  elements.btnGenerate.textContent = state.isGenerating ? "Generando..." : "Generar Excel + JSON";
}

function updateSummary() {
  const validation = state.validation;
  if (!validation) {
    elements.totalFiles.textContent = String(state.selectedPaths.length);
    elements.validFiles.textContent = "0";
    elements.invalidFiles.textContent = "0";
    elements.duplicateFiles.textContent = "0";
    return;
  }

  elements.totalFiles.textContent = String(validation.total || 0);
  elements.validFiles.textContent = String(validation.validCount || 0);
  elements.invalidFiles.textContent = String(validation.invalidCount || 0);
  elements.duplicateFiles.textContent = String(validation.duplicateCount || 0);
}

function renderEmptyFiles() {
  elements.filesTableContainer.innerHTML = '<div class="empty">Aquí aparecerán los PDF seleccionados.</div>';
}

function renderSelectedPathsOnly() {
  if (!state.selectedPaths.length) {
    renderEmptyFiles();
    return;
  }

  const rows = state.selectedPaths
    .map((filePath, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(filePath.split(/[\\/]/).pop())}</td>
        <td class="path-text">${escapeHtml(filePath)}</td>
        <td><span class="badge badge-warning">Pendiente</span></td>
        <td>Ejecuta la validación del apartado.</td>
      </tr>
    `)
    .join("");

  elements.filesTableContainer.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead><tr><th>#</th><th>Archivo</th><th>Ruta</th><th>Estado</th><th>Observación</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderValidationTable() {
  const validation = state.validation;
  if (!validation || !Array.isArray(validation.files) || !validation.files.length) {
    renderEmptyFiles();
    return;
  }

  const rows = validation.files
    .map((file, index) => {
      const statusClass = file.valid ? "badge-ok" : "badge-error";
      const statusText = file.valid ? "Válido" : "Revisar";
      const messages = [
        ...(Array.isArray(file.errors) ? file.errors : []),
        ...(Array.isArray(file.warnings) ? file.warnings : [])
      ];
      const observation = messages.length ? messages.join(" | ") : "Listo para extracción.";
      const hash = file.fileHash ? `${file.fileHash.slice(0, 12)}…` : "No disponible";

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(file.name)}</td>
          <td>${escapeHtml(file.sizeMB)} MB</td>
          <td>${escapeHtml(hash)}</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td>${escapeHtml(observation)}</td>
        </tr>
      `;
    })
    .join("");

  elements.filesTableContainer.innerHTML = `
    <div class="table-scroll">
      <table>
        <thead><tr><th>#</th><th>Archivo</th><th>Tamaño</th><th>Huella SHA-256</th><th>Estado</th><th>Observación</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderResult(result) {
  if (!result || !result.ok) {
    elements.resultsContainer.innerHTML = "";
    return;
  }

  const summary = result.summary || {};
  const files = result.files || {};
  const excel = files.excel || {};
  const json = files.json || {};
  const rowsByTable = summary.rows_by_table || {};
  const tableRows = Object.keys(rowsByTable)
    .map((tableName) => `
      <tr>
        <td>${escapeHtml(tableName)}</td>
        <td>${escapeHtml(rowsByTable[tableName])}</td>
        <td>${escapeHtml((summary.warnings_by_table || {})[tableName] || 0)}</td>
      </tr>
    `)
    .join("");

  elements.resultsContainer.innerHTML = `
    <div class="status-box status-success">Reporte generado correctamente.</div>
    <div class="result-links">
      <div class="result-path"><strong>Excel:</strong> ${escapeHtml(excel.filePath || "")}</div>
      <div class="result-path"><strong>JSON:</strong> ${escapeHtml(json.filePath || "")}</div>
    </div>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Tabla</th><th>Filas</th><th>Advertencias</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

function resetWorkflow() {
  state.selectedPaths = [];
  state.validation = null;
  state.outputDir = "";
  state.isGenerating = false;
  state.lastResult = null;

  setStatus(
    state.activeType && state.activeType.enabled
      ? "Esperando selección de documentos."
      : "Este módulo todavía no está habilitado para extracción.",
    state.activeType && state.activeType.enabled ? "info" : "warning"
  );
  setOutputStatus("Carpeta de salida no seleccionada.", "info");
  elements.resultsContainer.innerHTML = "";
  updateSummary();
  updateButtons();
  renderEmptyFiles();
}

function selectDocumentType(documentTypeId) {
  const definition = state.documentTypes.find((item) => item.id === documentTypeId);
  if (!definition) return;
  state.activeType = definition;
  resetWorkflow();
  renderActiveType();
  updateButtons();
}

async function loadAppInfo() {
  try {
    const info = await window.documentAppAPI.getAppInfo();
    elements.appVersion.textContent = `${info.appName} v${info.version}`;
  } catch (error) {
    elements.appVersion.textContent = "Versión no disponible";
  }
}

async function loadDocumentTypes() {
  const definitions = await window.documentAppAPI.listDocumentTypes();
  state.documentTypes = Array.isArray(definitions) ? definitions : [];
  const firstEnabled = state.documentTypes.find((definition) => definition.enabled);
  const first = firstEnabled || state.documentTypes[0] || null;
  if (first) selectDocumentType(first.id);
  else {
    renderSections();
    updateButtons();
  }
}

async function handleSelectPdfFiles() {
  if (!hasBridge() || !state.activeType || !state.activeType.enabled) {
    setStatus("El módulo seleccionado todavía no está disponible.", "warning");
    return;
  }

  try {
    const result = await window.documentAppAPI.selectPdfFiles(state.activeType.id);
    if (result.canceled) {
      setStatus("Selección cancelada. No se cargaron documentos.", "warning");
      return;
    }

    state.selectedPaths = Array.isArray(result.filePaths) ? result.filePaths : [];
    state.validation = null;
    state.lastResult = null;
    elements.resultsContainer.innerHTML = "";

    if (!state.selectedPaths.length) {
      setStatus("No se seleccionaron archivos.", "warning");
      updateSummary();
      updateButtons();
      renderEmptyFiles();
      return;
    }

    setStatus(`Se seleccionaron ${state.selectedPaths.length} documento(s). Ejecuta la validación.`, "success");
    updateSummary();
    updateButtons();
    renderSelectedPathsOnly();
  } catch (error) {
    setStatus(`Error al seleccionar PDF: ${error.message}`, "danger");
  }
}

async function handleValidatePdfFiles() {
  if (!state.activeType || !state.selectedPaths.length) {
    setStatus("Primero selecciona los PDF del apartado.", "warning");
    return;
  }

  try {
    const validation = await window.documentAppAPI.validatePdfFiles({
      documentType: state.activeType.id,
      filePaths: state.selectedPaths
    });

    state.validation = validation;
    state.lastResult = null;
    updateSummary();
    updateButtons();
    renderValidationTable();

    if (!validation.canContinue) {
      setStatus("No hay PDF válidos para continuar. Revisa los archivos marcados.", "danger");
      return;
    }

    if (validation.invalidCount > 0 || validation.typeWarningCount > 0) {
      setStatus(
        `Validación completada: ${validation.validCount} válido(s), ${validation.invalidCount} con error y ${validation.typeWarningCount || 0} con advertencia de tipo.`,
        "warning"
      );
      return;
    }

    setStatus(`Validación completada: ${validation.validCount} PDF válido(s) listos para extracción.`, "success");
  } catch (error) {
    setStatus(`Error al validar documentos: ${error.message}`, "danger");
  }
}

async function handleChooseOutputDirectory() {
  try {
    const result = await window.documentAppAPI.chooseOutputDirectory();
    if (result.canceled) {
      setOutputStatus("Selección de carpeta cancelada.", "warning");
      return;
    }
    state.outputDir = result.outputDir || "";
    setOutputStatus(`Carpeta de salida seleccionada: ${state.outputDir}`, "success");
    updateButtons();
  } catch (error) {
    setOutputStatus(`Error al seleccionar carpeta: ${error.message}`, "danger");
  }
}

async function handleGenerateReport() {
  if (!state.activeType || !state.activeType.enabled) {
    setStatus("El extractor de este apartado todavía no está habilitado.", "warning");
    return;
  }
  if (!state.validation || !state.validation.canContinue) {
    setStatus("Primero valida los PDF antes de generar el reporte.", "warning");
    return;
  }
  if (!state.outputDir) {
    setOutputStatus("Selecciona una carpeta de salida antes de generar.", "warning");
    return;
  }

  state.isGenerating = true;
  state.lastResult = null;
  updateButtons();
  setStatus("Procesando PDF y construyendo las tablas del apartado...", "info");
  setOutputStatus("Generando archivos Excel y JSON...", "info");

  try {
    const result = await window.documentAppAPI.generateDocumentReport({
      documentType: state.activeType.id,
      filePaths: state.selectedPaths,
      outputDir: state.outputDir
    });

    state.lastResult = result;
    if (!result.ok) {
      setStatus(result.message || "No se pudo generar el reporte.", "danger");
      setOutputStatus("No se generaron archivos de salida.", "danger");
      renderResult(null);
      return;
    }

    const summary = result.summary || {};
    const revisionRows = Number(summary.requiere_revision_rows || 0);
    const totalRows = Number(summary.total_rows || 0);
    setStatus(
      `Reporte generado: ${totalRows} fila(s) totales. Registros para revisión: ${revisionRows}.`,
      revisionRows > 0 ? "warning" : "success"
    );
    setOutputStatus(`Archivos creados en: ${result.outputDir}`, "success");
    renderResult(result);
  } catch (error) {
    setStatus(`Error al generar reporte: ${error.message}`, "danger");
    setOutputStatus("Ocurrió un error durante la generación.", "danger");
  } finally {
    state.isGenerating = false;
    updateButtons();
  }
}

function bindEvents() {
  elements.btnSelectPdf.addEventListener("click", handleSelectPdfFiles);
  elements.btnValidate.addEventListener("click", handleValidatePdfFiles);
  elements.btnClear.addEventListener("click", resetWorkflow);
  elements.btnChooseOutput.addEventListener("click", handleChooseOutputDirectory);
  elements.btnGenerate.addEventListener("click", handleGenerateReport);
}

async function init() {
  bindEvents();

  if (!hasBridge()) {
    elements.pageTitle.textContent = "API de Electron no disponible";
    elements.pageDescription.textContent = "Abre la aplicación con npm start para utilizar los apartados documentales.";
    setStatus("No está disponible la comunicación segura con Electron.", "danger");
    updateButtons();
    return;
  }

  try {
    await Promise.all([loadAppInfo(), loadDocumentTypes()]);
  } catch (error) {
    elements.pageTitle.textContent = "No se pudo iniciar la aplicación";
    elements.pageDescription.textContent = error.message;
    setStatus(`Error de inicialización: ${error.message}`, "danger");
  }
}

document.addEventListener("DOMContentLoaded", init);
