/* =========================================================
Nombre completo: app.js
Ruta o ubicación: /renderer/app.js
Función o funciones:
- Controlar las secciones independientes de Planes y Acuerdos.
- Consultar y mostrar la base local compartida.
========================================================= */
"use strict";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function statusClass(type) {
  return `status-box status-${["info", "success", "warning", "danger"].includes(type) ? type : "info"}`;
}
function fileName(filePath) { return String(filePath || "").split(/[\\/]/).pop(); }
function formatNumber(value) { return new Intl.NumberFormat("es-EC").format(Number(value || 0)); }
function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function createModule(config) {
  const state = { selectedPaths: [], validation: null, outputDir: "", generating: false };
  const el = Object.fromEntries(Object.entries(config.ids).map(([key, id]) => [key, document.getElementById(id)]));

  function setStatus(message, type = "info") {
    el.status.className = statusClass(type);
    el.status.textContent = message;
  }
  function setOutput(message, type = "info") {
    el.output.className = statusClass(type);
    el.output.textContent = message;
  }
  function updateSummary() {
    const validation = state.validation;
    el.total.textContent = String(validation?.total ?? state.selectedPaths.length);
    el.valid.textContent = String(validation?.validCount || 0);
    el.invalid.textContent = String(validation?.invalidCount || 0);
    el.ready.textContent = validation?.canContinue ? "Sí" : "No";
  }
  function updateButtons() {
    const hasFiles = state.selectedPaths.length > 0;
    const canGenerate = Boolean(state.validation?.canContinue && state.outputDir && !state.generating);
    el.select.disabled = state.generating;
    el.validate.disabled = !hasFiles || state.generating;
    el.clear.disabled = !hasFiles || state.generating;
    el.outputSelect.disabled = state.generating;
    el.generate.disabled = !canGenerate;
    el.generate.textContent = state.generating ? "Generando..." : "Generar Excel + JSON";
  }
  function renderSelected() {
    if (!state.selectedPaths.length) {
      el.files.innerHTML = `<div class="empty">${escapeHtml(config.emptyText)}</div>`;
      return;
    }
    const rows = state.selectedPaths.map((path, index) => `
      <tr><td>${index + 1}</td><td>${escapeHtml(fileName(path))}</td><td>${escapeHtml(path)}</td>
      <td><span class="badge badge-warning">Pendiente</span></td><td>Ejecuta la validación.</td></tr>`).join("");
    el.files.innerHTML = `<table><thead><tr><th>#</th><th>Archivo</th><th>Ruta</th><th>Estado</th><th>Observación</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderValidation() {
    const files = state.validation?.files || [];
    if (!files.length) { renderSelected(); return; }
    const rows = files.map((file, index) => {
      const ok = file.valid;
      const detected = file.detectedType === "plan-individual" ? "Plan Individual"
        : file.detectedType === "acuerdo-patrocinio" ? "Acuerdo" : "No identificado";
      return `<tr>
        <td>${index + 1}</td><td>${escapeHtml(file.name)}</td><td>${escapeHtml(file.sizeMB)} MB</td>
        <td>${escapeHtml(detected)}</td><td><span class="badge ${ok ? "badge-ok" : "badge-error"}">${ok ? "Válido" : "Revisar"}</span></td>
        <td>${escapeHtml((file.errors || []).join(" | ") || "Listo para procesar.")}</td>
      </tr>`;
    }).join("");
    el.files.innerHTML = `<table><thead><tr><th>#</th><th>Archivo</th><th>Tamaño</th><th>Tipo detectado</th><th>Estado</th><th>Observación</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderResult(result) {
    if (!result?.ok) { el.result.innerHTML = ""; return; }
    const persistence = result.persistence || {};
    const rows = Object.entries(result.summary?.rows_by_table || {}).map(([name, count]) =>
      `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(count)}</td></tr>`).join("");
    el.result.innerHTML = `<div class="result-box">
      <div class="status-box status-success">Reporte generado correctamente.</div>
      <div class="result-files">
        Excel: ${escapeHtml(result.files?.excel?.filePath || "")}<br>
        JSON: ${escapeHtml(result.files?.json?.filePath || "")}<br>
        Guardados en base local: ${escapeHtml(persistence.documentsSaved || 0)} documento(s), ${escapeHtml(persistence.rowsSaved || 0)} fila(s).<br>
        Duplicados omitidos en la base: ${escapeHtml(persistence.duplicateDocumentsSkipped || 0)}.
      </div>
      <table><thead><tr><th>Tabla</th><th>Filas</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }
  function reset() {
    state.selectedPaths = [];
    state.validation = null;
    state.outputDir = "";
    state.generating = false;
    setStatus(config.initialStatus, "info");
    setOutput("Carpeta de salida no seleccionada.", "info");
    el.result.innerHTML = "";
    updateSummary(); updateButtons(); renderSelected();
  }

  async function selectFiles() {
    try {
      const result = await window.documentAppAPI.selectDocumentFiles(config.documentType);
      if (result.canceled) { setStatus("Selección cancelada.", "warning"); return; }
      state.selectedPaths = Array.isArray(result.filePaths) ? result.filePaths : [];
      state.validation = null;
      el.result.innerHTML = "";
      setStatus(`Se seleccionaron ${state.selectedPaths.length} documento(s). Ejecuta la validación.`, state.selectedPaths.length ? "success" : "warning");
      updateSummary(); updateButtons(); renderSelected();
    } catch (error) { setStatus(`Error al seleccionar archivos: ${error.message}`, "danger"); }
  }
  async function validateFiles() {
    try {
      setStatus("Leyendo y verificando el tipo de los PDF...", "info");
      state.validation = await window.documentAppAPI.validateDocumentFiles({
        documentType: config.documentType,
        filePaths: state.selectedPaths
      });
      updateSummary(); updateButtons(); renderValidation();
      if (!state.validation.canContinue) setStatus("No existen documentos válidos para esta sección.", "danger");
      else if (state.validation.invalidCount) setStatus(`Validación terminada: ${state.validation.validCount} válido(s) y ${state.validation.invalidCount} para revisar.`, "warning");
      else setStatus(`Validación terminada: ${state.validation.validCount} documento(s) listo(s).`, "success");
    } catch (error) { setStatus(`Error al validar: ${error.message}`, "danger"); }
  }
  async function chooseOutput() {
    try {
      const result = await window.documentAppAPI.chooseOutputDirectory();
      if (result.canceled) { setOutput("Selección de carpeta cancelada.", "warning"); return; }
      state.outputDir = result.outputDir || "";
      setOutput(`Carpeta seleccionada: ${state.outputDir}`, "success");
      updateButtons();
    } catch (error) { setOutput(`Error al seleccionar carpeta: ${error.message}`, "danger"); }
  }
  async function generate() {
    if (!state.validation?.canContinue || !state.outputDir) return;
    state.generating = true; updateButtons();
    setStatus("Procesando documentos y guardando datos localmente...", "info");
    setOutput("Generando Excel y JSON...", "info");
    try {
      const result = await window.documentAppAPI.generateDocumentReport({
        documentType: config.documentType,
        filePaths: state.selectedPaths,
        outputDir: state.outputDir
      });
      if (!result.ok) {
        setStatus(result.message || "No se pudo procesar.", "danger");
        setOutput("No se generaron archivos de salida.", "danger");
        return;
      }
      const revision = Number(result.summary?.requiere_revision_rows || 0);
      setStatus(`Proceso completado. Registros para revisión: ${revision}.`, revision ? "warning" : "success");
      setOutput(`Archivos creados en: ${result.outputDir}`, "success");
      renderResult(result);
      await refreshDatabase();
    } catch (error) {
      setStatus(`Error al generar: ${error.message}`, "danger");
      setOutput("Ocurrió un error durante la generación.", "danger");
    } finally { state.generating = false; updateButtons(); }
  }

  el.select.addEventListener("click", selectFiles);
  el.validate.addEventListener("click", validateFiles);
  el.clear.addEventListener("click", reset);
  el.outputSelect.addEventListener("click", chooseOutput);
  el.generate.addEventListener("click", generate);
  reset();
  return { reset };
}

const databaseElements = {
  documents: document.getElementById("dbDocuments"), plans: document.getElementById("dbPlans"),
  agreements: document.getElementById("dbAgreements"), rows: document.getElementById("dbRows"),
  runs: document.getElementById("dbRuns"), duplicates: document.getElementById("dbDuplicates"),
  status: document.getElementById("databaseStatus"), documentsTable: document.getElementById("dbDocumentsTable"),
  runsTable: document.getElementById("dbRunsTable"), refresh: document.getElementById("btnRefreshDatabase"),
  open: document.getElementById("btnOpenDatabase")
};

function renderDatabaseDocuments(documents) {
  if (!documents.length) { databaseElements.documentsTable.innerHTML = '<div class="empty">Todavía no hay documentos guardados.</div>'; return; }
  const rows = documents.map((doc) => `<tr>
    <td>${escapeHtml(formatDate(doc.fecha_registro))}</td><td>${escapeHtml(doc.nombre_tipo_documental)}</td>
    <td>${escapeHtml(doc.nombre_archivo)}</td><td>${escapeHtml(doc.docente)}</td>
    <td>${escapeHtml(doc.codigo_documento)}</td><td><span class="badge ${doc.requiere_revision === "SI" ? "badge-warning" : "badge-ok"}">${escapeHtml(doc.requiere_revision === "SI" ? "Revisar" : "Guardado")}</span></td>
  </tr>`).join("");
  databaseElements.documentsTable.innerHTML = `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Archivo</th><th>Docente</th><th>Código</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderDatabaseRuns(runs) {
  if (!runs.length) { databaseElements.runsTable.innerHTML = '<div class="empty">Todavía no hay procesamientos.</div>'; return; }
  const rows = runs.map((run) => `<tr>
    <td>${escapeHtml(formatDate(run.fecha_fin || run.fecha_inicio))}</td><td>${escapeHtml(run.nombre_tipo_documental)}</td>
    <td>${escapeHtml(run.documentos_guardados)}</td><td>${escapeHtml(run.documentos_duplicados_omitidos)}</td>
    <td>${escapeHtml(run.filas_guardadas)}</td><td><span class="badge ${run.estado === "COMPLETADO" ? "badge-ok" : "badge-warning"}">${escapeHtml(run.estado)}</span></td>
  </tr>`).join("");
  databaseElements.runsTable.innerHTML = `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Nuevos</th><th>Duplicados</th><th>Filas</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table>`;
}
async function refreshDatabase() {
  if (!window.documentAppAPI) return;
  databaseElements.refresh.disabled = true;
  databaseElements.status.className = statusClass("info");
  databaseElements.status.textContent = "Actualizando la base local...";
  try {
    const [summary, documentsResult, runsResult] = await Promise.all([
      window.documentAppAPI.getDatabaseSummary(),
      window.documentAppAPI.listRecentDocuments({ limit: 20 }),
      window.documentAppAPI.listRecentDatabaseRuns({ limit: 10 })
    ]);
    databaseElements.documents.textContent = formatNumber(summary.documentCount);
    databaseElements.plans.textContent = formatNumber(summary.planCount);
    databaseElements.agreements.textContent = formatNumber(summary.agreementCount);
    databaseElements.rows.textContent = formatNumber(summary.tableRows);
    databaseElements.runs.textContent = formatNumber(summary.processingRunCount);
    databaseElements.duplicates.textContent = formatNumber(summary.duplicateCount);
    databaseElements.status.className = statusClass("success");
    databaseElements.status.textContent = `Base local disponible en: ${summary.databasePath}`;
    renderDatabaseDocuments(documentsResult.documents || []);
    renderDatabaseRuns(runsResult.runs || []);
  } catch (error) {
    databaseElements.status.className = statusClass("danger");
    databaseElements.status.textContent = `No se pudo consultar la base local: ${error.message}`;
  } finally { databaseElements.refresh.disabled = false; }
}
async function openDatabase() {
  try {
    const result = await window.documentAppAPI.openDatabaseFolder();
    databaseElements.status.className = statusClass("success");
    databaseElements.status.textContent = `Carpeta abierta: ${result.databasePath}`;
  } catch (error) {
    databaseElements.status.className = statusClass("danger");
    databaseElements.status.textContent = `No se pudo abrir la carpeta: ${error.message}`;
  }
}

async function initialize() {
  if (!window.documentAppAPI) {
    document.getElementById("appVersion").textContent = "API de Electron no disponible";
    return;
  }
  try {
    const info = await window.documentAppAPI.getAppInfo();
    document.getElementById("appVersion").textContent = `${info.appName} v${info.version}`;
  } catch (_error) { document.getElementById("appVersion").textContent = "Versión no disponible"; }

  createModule({
    documentType: "plan-individual",
    initialStatus: "Esperando selección de Planes Individuales.",
    emptyText: "Aquí aparecerán los planes seleccionados.",
    ids: {
      select: "planSelect", validate: "planValidate", clear: "planClear", outputSelect: "planOutputSelect",
      generate: "planGenerate", status: "planStatus", output: "planOutput", total: "planTotal",
      valid: "planValid", invalid: "planInvalid", ready: "planReady", files: "planFiles", result: "planResult"
    }
  });
  createModule({
    documentType: "acuerdo-patrocinio",
    initialStatus: "Esperando selección de Acuerdos de Patrocinio.",
    emptyText: "Aquí aparecerán los acuerdos seleccionados.",
    ids: {
      select: "agreementSelect", validate: "agreementValidate", clear: "agreementClear", outputSelect: "agreementOutputSelect",
      generate: "agreementGenerate", status: "agreementStatus", output: "agreementOutput", total: "agreementTotal",
      valid: "agreementValid", invalid: "agreementInvalid", ready: "agreementReady", files: "agreementFiles", result: "agreementResult"
    }
  });
  databaseElements.refresh.addEventListener("click", refreshDatabase);
  databaseElements.open.addEventListener("click", openDatabase);
  await refreshDatabase();
}

document.addEventListener("DOMContentLoaded", initialize);
