/* =========================================================
Nombre completo: app.js
Ruta o ubicación: /plan-docente-extractor/renderer/app.js
Función o funciones:
- Controlar la interfaz principal del renderer.
- Ejecutar selección múltiple de PDF usando la API segura del preload.
- Validar archivos seleccionados desde el proceso principal.
- Mostrar resumen de documentos válidos, inválidos y duplicados.
- Guardar temporalmente la carpeta de salida elegida.
- Preparar la interfaz para la extracción y exportación Excel + JSON.
========================================================= */

"use strict";

const state = {
  selectedPaths: [],
  validation: null,
  outputDir: ""
};

const elements = {
  appVersion: document.getElementById("appVersion"),
  btnSelectPdf: document.getElementById("btnSelectPdf"),
  btnValidate: document.getElementById("btnValidate"),
  btnClear: document.getElementById("btnClear"),
  btnChooseOutput: document.getElementById("btnChooseOutput"),
  btnGenerate: document.getElementById("btnGenerate"),
  emptyBox: document.getElementById("emptyBox"),
  statusBox: document.getElementById("statusBox"),
  outputBox: document.getElementById("outputBox"),
  totalFiles: document.getElementById("totalFiles"),
  validFiles: document.getElementById("validFiles"),
  invalidFiles: document.getElementById("invalidFiles"),
  readyState: document.getElementById("readyState"),
  filesTableContainer: document.getElementById("filesTableContainer")
};

function hasBridge() {
  return Boolean(window.planDocenteAPI);
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

function updateButtons() {
  const hasFiles = state.selectedPaths.length > 0;
  const hasValidation = Boolean(state.validation);
  const canGenerate = Boolean(
    hasValidation &&
    state.validation.canContinue &&
    state.outputDir
  );

  elements.btnValidate.disabled = !hasFiles;
  elements.btnClear.disabled = !hasFiles;
  elements.btnGenerate.disabled = !canGenerate;
}

function updateSummary() {
  const validation = state.validation;

  if (!validation) {
    elements.totalFiles.textContent = String(state.selectedPaths.length);
    elements.validFiles.textContent = "0";
    elements.invalidFiles.textContent = "0";
    elements.readyState.textContent = "No";
    return;
  }

  elements.totalFiles.textContent = String(validation.total || 0);
  elements.validFiles.textContent = String(validation.validCount || 0);
  elements.invalidFiles.textContent = String(validation.invalidCount || 0);
  elements.readyState.textContent = validation.canContinue ? "Sí" : "No";
}

function renderEmptyFiles() {
  elements.filesTableContainer.innerHTML = `
    <div class="empty">
      Aquí aparecerá la lista de PDF seleccionados.
    </div>
  `;
}

function renderSelectedPathsOnly() {
  if (!state.selectedPaths.length) {
    renderEmptyFiles();
    return;
  }

  const rows = state.selectedPaths
    .map((filePath, index) => {
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(filePath.split(/[\\/]/).pop())}</td>
          <td>${escapeHtml(filePath)}</td>
          <td><span class="badge badge-ok">Pendiente validación</span></td>
          <td>Seleccionado correctamente.</td>
        </tr>
      `;
    })
    .join("");

  elements.filesTableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Archivo</th>
          <th>Ruta</th>
          <th>Estado</th>
          <th>Observación</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
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
      const errors = Array.isArray(file.errors) && file.errors.length
        ? file.errors.join(" | ")
        : "Listo para extracción.";

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(file.name)}</td>
          <td>${escapeHtml(file.path)}</td>
          <td>${escapeHtml(file.sizeMB)} MB</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td>${escapeHtml(errors)}</td>
        </tr>
      `;
    })
    .join("");

  elements.filesTableContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Archivo</th>
          <th>Ruta</th>
          <th>Tamaño</th>
          <th>Estado</th>
          <th>Observación</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function resetState() {
  state.selectedPaths = [];
  state.validation = null;
  state.outputDir = "";

  elements.emptyBox.style.display = "block";
  setStatus("Esperando selección de documentos.", "info");
  setOutputStatus("Carpeta de salida no seleccionada.", "info");

  updateSummary();
  updateButtons();
  renderEmptyFiles();
}

async function loadAppInfo() {
  if (!hasBridge()) {
    elements.appVersion.textContent = "API de Electron no disponible";
    return;
  }

  try {
    const info = await window.planDocenteAPI.getAppInfo();
    elements.appVersion.textContent = `${info.appName} v${info.version}`;
  } catch (error) {
    elements.appVersion.textContent = "No se pudo cargar la versión";
  }
}

async function handleSelectPdfFiles() {
  if (!hasBridge()) {
    setStatus("No está disponible la comunicación con Electron.", "danger");
    return;
  }

  try {
    const result = await window.planDocenteAPI.selectPdfFiles();

    if (result.canceled) {
      setStatus("Selección cancelada. No se cargaron documentos.", "warning");
      return;
    }

    state.selectedPaths = Array.isArray(result.filePaths) ? result.filePaths : [];
    state.validation = null;

    if (!state.selectedPaths.length) {
      setStatus("No se seleccionaron archivos.", "warning");
      updateSummary();
      updateButtons();
      renderEmptyFiles();
      return;
    }

    elements.emptyBox.style.display = "none";
    setStatus(`Se seleccionaron ${state.selectedPaths.length} documento(s). Ejecuta la validación.`, "success");

    updateSummary();
    updateButtons();
    renderSelectedPathsOnly();
  } catch (error) {
    setStatus(`Error al seleccionar PDF: ${error.message}`, "danger");
  }
}

async function handleValidatePdfFiles() {
  if (!hasBridge()) {
    setStatus("No está disponible la comunicación con Electron.", "danger");
    return;
  }

  if (!state.selectedPaths.length) {
    setStatus("Primero selecciona uno o varios PDF.", "warning");
    return;
  }

  try {
    const validation = await window.planDocenteAPI.validatePdfFiles(state.selectedPaths);
    state.validation = validation;

    updateSummary();
    updateButtons();
    renderValidationTable();

    if (!validation.canContinue) {
      setStatus("No hay PDF válidos para continuar. Revisa los archivos marcados.", "danger");
      return;
    }

    if (validation.invalidCount > 0) {
      setStatus(
        `Validación completada: ${validation.validCount} válido(s) y ${validation.invalidCount} para revisar. Se podrá generar el reporte marcando revisión.`,
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
  if (!hasBridge()) {
    setOutputStatus("No está disponible la comunicación con Electron.", "danger");
    return;
  }

  try {
    const result = await window.planDocenteAPI.chooseOutputDirectory();

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

function handleGeneratePlaceholder() {
  setStatus(
    "La base ya está lista. En el siguiente bloque conectaremos el extractor PDF y los exportadores Excel + JSON.",
    "info"
  );
}

function bindEvents() {
  elements.btnSelectPdf.addEventListener("click", handleSelectPdfFiles);
  elements.btnValidate.addEventListener("click", handleValidatePdfFiles);
  elements.btnClear.addEventListener("click", resetState);
  elements.btnChooseOutput.addEventListener("click", handleChooseOutputDirectory);
  elements.btnGenerate.addEventListener("click", handleGeneratePlaceholder);
}

function init() {
  bindEvents();
  resetState();
  loadAppInfo();
}

document.addEventListener("DOMContentLoaded", init);
