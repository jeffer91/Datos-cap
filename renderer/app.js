"use strict";

const api = window.plansAPI;

const state = {
  selectedFiles: [],
  records: [],
  summary: { total: 0, completos: 0, revisar: 0, errores: 0, capacitaciones: 0 },
  busy: false,
  currentRecord: null
};

const elements = {};

function byId(id) {
  return document.getElementById(id);
}

function cacheElements() {
  [
    "filesButton", "folderButton", "selectionPanel", "selectionCount", "selectionHint",
    "clearSelectionButton", "processButton", "progressCard", "progressTitle", "progressFile",
    "progressPercent", "progressBar", "progressMessage", "statTotal", "statComplete",
    "statReview", "statTrainings", "resultsSubtitle", "searchInput", "statusFilter",
    "excelButton", "jsonButton", "resultsBody", "emptyState", "visibleCount",
    "clearDataButton", "openDataButton", "versionLabel", "drawerBackdrop", "detailDrawer",
    "drawerTitle", "drawerContent", "closeDrawerButton", "closeDrawerFooterButton",
    "openPdfButton", "toastStack"
  ].forEach((id) => { elements[id] = byId(id); });
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function displayValue(value, fallback = "No encontrado") {
  const clean = String(value == null ? "" : value).trim();
  return clean || fallback;
}

function listText(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(" · ") : displayValue(value);
}

function toast(message, type = "") {
  const item = document.createElement("div");
  item.className = `toast${type ? ` ${type}` : ""}`;
  item.textContent = message;
  elements.toastStack.appendChild(item);
  window.setTimeout(() => item.remove(), 3600);
}

function setBusy(value) {
  state.busy = Boolean(value);
  elements.filesButton.disabled = state.busy;
  elements.folderButton.disabled = state.busy;
  elements.processButton.disabled = state.busy || !state.selectedFiles.length;
  elements.clearSelectionButton.disabled = state.busy;
  elements.excelButton.disabled = state.busy || !state.records.length;
  elements.jsonButton.disabled = state.busy || !state.records.length;
  elements.clearDataButton.disabled = state.busy || !state.records.length;
}

function updateSelection() {
  const count = state.selectedFiles.length;
  elements.selectionPanel.classList.toggle("hidden", count === 0);
  elements.selectionCount.textContent = `${count} ${count === 1 ? "archivo" : "archivos"}`;
  elements.selectionHint.textContent = count >= 500
    ? "Se alcanzó el máximo de 500 archivos"
    : "Listos para procesar";
  elements.processButton.disabled = state.busy || count === 0;
}

function updateStats() {
  elements.statTotal.textContent = state.summary.total || 0;
  elements.statComplete.textContent = state.summary.completos || 0;
  elements.statReview.textContent = (state.summary.revisar || 0) + (state.summary.errores || 0);
  elements.statTrainings.textContent = state.summary.capacitaciones || 0;
  elements.resultsSubtitle.textContent = state.records.length
    ? `${state.records.length} planes guardados`
    : "Todavía no hay planes procesados";
  elements.excelButton.disabled = state.busy || !state.records.length;
  elements.jsonButton.disabled = state.busy || !state.records.length;
  elements.clearDataButton.disabled = state.busy || !state.records.length;
}

function statusInfo(record) {
  if (record.estado === "COMPLETO") return { label: "Completo", className: "complete" };
  if (record.estado === "REVISAR") return { label: "Revisar", className: "review" };
  return { label: "Error", className: "error" };
}

function filteredRecords() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  return state.records.filter((record) => {
    const haystack = [
      record.docente?.nombre,
      record.docente?.carrera,
      record.docente?.codigo_documento,
      record.archivo?.nombre
    ].join(" ").toLowerCase();
    const statusMatch = !status
      || record.estado === status
      || (status === "ERROR" && ["ERROR", "NO_ES_PLAN"].includes(record.estado));
    return (!query || haystack.includes(query)) && statusMatch;
  });
}

function renderTable() {
  const records = filteredRecords();
  elements.resultsBody.innerHTML = "";
  elements.emptyState.classList.toggle("hidden", records.length > 0);

  records.forEach((record) => {
    const status = statusInfo(record);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="status-pill ${status.className}">${status.label}</span></td>
      <td class="teacher-cell">
        <strong>${escapeHtml(displayValue(record.docente?.nombre, record.archivo?.nombre || "Sin nombre"))}</strong>
        <span>${escapeHtml(displayValue(record.docente?.codigo_documento, record.archivo?.nombre || ""))}</span>
      </td>
      <td>${escapeHtml(displayValue(record.docente?.carrera))}</td>
      <td>${escapeHtml(displayValue(record.docente?.periodo_plan, "—"))}</td>
      <td>${record.capacitaciones?.length || 0}</td>
      <td><span class="method-pill">${escapeHtml(displayValue(record.archivo?.metodo_lectura, "—"))}</span></td>
      <td><button class="detail-button" type="button">Ver</button></td>
    `;
    row.querySelector(".detail-button").addEventListener("click", () => openDrawer(record));
    elements.resultsBody.appendChild(row);
  });

  elements.visibleCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
}

function detailItem(label, value, full = false) {
  return `
    <div class="detail-item${full ? " full" : ""}">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(displayValue(value))}</p>
    </div>
  `;
}

function trainingHtml(training, index) {
  const theory = listText(training.actividades_teoricas);
  const practice = listText(training.actividades_practicas);
  return `
    <article class="training-card">
      <div class="training-head">
        <strong>${index + 1}. ${escapeHtml(displayValue(training.nombre))}</strong>
        <span>${escapeHtml(displayValue(training.horas, "0"))} h</span>
      </div>
      <div class="training-meta">
        ${escapeHtml(displayValue(training.fecha_rango_original, "Sin fecha"))} · ${escapeHtml(displayValue(training.tipo, "Sin tipo"))}
      </div>
      <div class="training-detail">
        <span>Teóricas</span><p>${escapeHtml(theory)}</p>
        <span>Prácticas</span><p>${escapeHtml(practice)}</p>
        <span>Impacto esperado</span><p>${escapeHtml(displayValue(training.impacto_esperado))}</p>
        <span>Visión a largo plazo</span><p>${escapeHtml(displayValue(training.vision_largo_plazo))}</p>
      </div>
    </article>
  `;
}

function openDrawer(record) {
  state.currentRecord = record;
  elements.drawerTitle.textContent = displayValue(record.docente?.nombre, record.archivo?.nombre || "Plan docente");
  const issues = [...(record.campos_faltantes || []), ...(record.advertencias || [])];
  const trainings = record.capacitaciones || [];

  elements.drawerContent.innerHTML = `
    <section class="detail-section">
      <h3>Datos del docente</h3>
      <div class="detail-grid">
        ${detailItem("Nombre", record.docente?.nombre, true)}
        ${detailItem("Carrera", record.docente?.carrera)}
        ${detailItem("Dedicación", record.docente?.tiempo_dedicacion)}
        ${detailItem("Nivel académico", record.docente?.nivel_academico_actual)}
        ${detailItem("Periodo", record.docente?.periodo_plan)}
        ${detailItem("Código", record.docente?.codigo_documento, true)}
      </div>
    </section>

    <section class="detail-section">
      <h3>Diagnóstico</h3>
      <div class="detail-grid">
        ${detailItem("Últimos 12 meses", record.diagnostico?.capacitacion_12_meses, true)}
        ${detailItem("Avances aplicados", record.diagnostico?.avances_aplicados, true)}
        ${detailItem("Comodidad con metodologías", record.diagnostico?.comodidad_metodologias, true)}
        ${detailItem("Estrategias pedagógicas", record.diagnostico?.estrategias_pedagogicas, true)}
        ${detailItem("Herramientas tecnológicas", record.diagnostico?.herramientas_tecnologicas, true)}
        ${detailItem("Formación adicional", record.diagnostico?.formacion_adicional, true)}
        ${detailItem("Tipo de formación", record.diagnostico?.tipo_formacion, true)}
      </div>
    </section>

    <section class="detail-section">
      <h3>Capacitaciones propuestas (${trainings.length})</h3>
      ${trainings.length ? trainings.map(trainingHtml).join("") : "<div class='detail-item'><p>No se encontraron capacitaciones.</p></div>"}
    </section>

    ${issues.length ? `
      <section class="detail-section">
        <h3>Revisión</h3>
        <ul class="issue-list">${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>
      </section>
    ` : ""}
  `;

  elements.drawerBackdrop.classList.remove("hidden");
  elements.detailDrawer.classList.add("open");
  elements.detailDrawer.setAttribute("aria-hidden", "false");
  elements.openPdfButton.disabled = !record.archivo?.ruta;
}

function closeDrawer() {
  state.currentRecord = null;
  elements.drawerBackdrop.classList.add("hidden");
  elements.detailDrawer.classList.remove("open");
  elements.detailDrawer.setAttribute("aria-hidden", "true");
}

function showProgress(progress) {
  elements.progressCard.classList.remove("hidden");
  const percent = Math.max(0, Math.min(100, Number(progress.percent ?? progress.overallPercent ?? 0)));
  elements.progressBar.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressFile.textContent = progress.fileName || "";
  elements.progressMessage.textContent = progress.message || "Procesando...";
  elements.progressTitle.textContent = progress.phase === "ocr-page" || progress.phase === "ocr-progress"
    ? "Reconociendo texto"
    : "Procesando planes";
  if (progress.phase === "complete") {
    elements.progressTitle.textContent = "Listo";
    window.setTimeout(() => elements.progressCard.classList.add("hidden"), 1800);
  }
}

async function loadRecords() {
  try {
    const result = await api.list();
    state.records = result.records || [];
    state.summary = result.summary || state.summary;
    updateStats();
    renderTable();
  } catch (error) {
    toast(error.message || "No se pudieron cargar los datos.", "error");
  }
}

async function selectFiles() {
  try {
    const result = await api.selectFiles();
    if (result.canceled) return;
    state.selectedFiles = result.filePaths || [];
    updateSelection();
  } catch (error) {
    toast(error.message || "No se pudieron seleccionar los archivos.", "error");
  }
}

async function selectFolder() {
  try {
    const result = await api.selectFolder();
    if (result.canceled) return;
    state.selectedFiles = result.filePaths || [];
    updateSelection();
    if (result.truncated) toast("Se cargaron los primeros 500 PDF.");
    if (!state.selectedFiles.length) toast("La carpeta no contiene archivos PDF.", "error");
  } catch (error) {
    toast(error.message || "No se pudo leer la carpeta.", "error");
  }
}

async function processSelection() {
  if (!state.selectedFiles.length || state.busy) return;
  setBusy(true);
  elements.progressCard.classList.remove("hidden");
  try {
    const result = await api.process(state.selectedFiles);
    state.selectedFiles = [];
    updateSelection();
    state.records = result.records?.length ? (await api.list()).records : state.records;
    state.summary = result.summary || state.summary;
    updateStats();
    renderTable();
    toast(`${result.processed} archivos procesados.`, "success");
  } catch (error) {
    toast(error.message || "No se pudo completar el procesamiento.", "error");
  } finally {
    setBusy(false);
  }
}

async function exportData(format) {
  try {
    const result = await api.export(format);
    if (!result.canceled) toast(`${format.toUpperCase()} guardado.`, "success");
  } catch (error) {
    toast(error.message || "No se pudo exportar.", "error");
  }
}

async function clearData() {
  if (!state.records.length || state.busy) return;
  const confirmed = window.confirm("¿Borrar todos los planes guardados?");
  if (!confirmed) return;
  try {
    const result = await api.clear();
    state.records = result.records || [];
    state.summary = result.summary || { total: 0, completos: 0, revisar: 0, errores: 0, capacitaciones: 0 };
    updateStats();
    renderTable();
    toast("Datos borrados.", "success");
  } catch (error) {
    toast(error.message || "No se pudieron borrar los datos.", "error");
  }
}

function bindEvents() {
  elements.filesButton.addEventListener("click", selectFiles);
  elements.folderButton.addEventListener("click", selectFolder);
  elements.clearSelectionButton.addEventListener("click", () => {
    state.selectedFiles = [];
    updateSelection();
  });
  elements.processButton.addEventListener("click", processSelection);
  elements.searchInput.addEventListener("input", renderTable);
  elements.statusFilter.addEventListener("change", renderTable);
  elements.excelButton.addEventListener("click", () => exportData("xlsx"));
  elements.jsonButton.addEventListener("click", () => exportData("json"));
  elements.clearDataButton.addEventListener("click", clearData);
  elements.openDataButton.addEventListener("click", async () => {
    try { await api.openDataFolder(); }
    catch (error) { toast(error.message || "No se pudo abrir la carpeta.", "error"); }
  });
  elements.closeDrawerButton.addEventListener("click", closeDrawer);
  elements.closeDrawerFooterButton.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);
  elements.openPdfButton.addEventListener("click", async () => {
    try {
      if (state.currentRecord?.archivo?.ruta) await api.openFile(state.currentRecord.archivo.ruta);
    } catch (error) {
      toast(error.message || "No se pudo abrir el PDF.", "error");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });
  api.onProgress(showProgress);
}

async function initialize() {
  cacheElements();
  bindEvents();
  setBusy(false);
  try {
    const info = await api.getAppInfo();
    elements.versionLabel.textContent = `v${info.version}`;
  } catch (_error) { /* se conserva la versión visible */ }
  await loadRecords();
}

document.addEventListener("DOMContentLoaded", initialize, { once: true });
