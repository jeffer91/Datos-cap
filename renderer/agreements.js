"use strict";

const api = window.agreementsAPI;

const state = {
  selectedFiles: [],
  records: [],
  planOptions: [],
  summary: { total: 0, completos: 0, revisar: 0, errores: 0, firmados: 0 },
  currentRecord: null,
  editing: false,
  busy: false
};

const elements = {};

function byId(id) { return document.getElementById(id); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function value(value, fallback = "No encontrado") {
  const clean = String(value == null ? "" : value).trim();
  return clean || fallback;
}

function cacheElements() {
  [
    "filesButton", "folderButton", "selectionPanel", "selectionCount", "selectionHint",
    "clearSelectionButton", "processButton", "progressCard", "progressTitle", "progressFile",
    "progressPercent", "progressBar", "progressMessage", "statTotal", "statComplete",
    "statReview", "statSigned", "resultsSubtitle", "searchInput", "statusFilter", "excelButton",
    "jsonButton", "resultsBody", "emptyState", "visibleCount", "clearDataButton", "versionLabel",
    "drawerBackdrop", "detailDrawer", "drawerTitle", "drawerContent", "closeDrawerButton",
    "openPdfButton", "editButton", "saveButton", "cancelButton", "toastStack"
  ].forEach((id) => { elements[id] = byId(id); });
}

function toast(message, type = "") {
  const item = document.createElement("div");
  item.className = `toast${type ? ` ${type}` : ""}`;
  item.textContent = message;
  elements.toastStack.appendChild(item);
  window.setTimeout(() => item.remove(), 3600);
}

function setBusy(busy) {
  state.busy = Boolean(busy);
  elements.filesButton.disabled = state.busy;
  elements.folderButton.disabled = state.busy;
  elements.processButton.disabled = state.busy || !state.selectedFiles.length;
  elements.clearSelectionButton.disabled = state.busy;
  elements.excelButton.disabled = state.busy || !state.records.length;
  elements.jsonButton.disabled = state.busy || !state.records.length;
  elements.clearDataButton.disabled = state.busy || !state.records.length;
  elements.openPdfButton.disabled = state.busy || !state.currentRecord?.archivo?.ruta;
  elements.editButton.disabled = state.busy || !state.currentRecord;
  elements.saveButton.disabled = state.busy || !state.editing;
  elements.cancelButton.disabled = state.busy || !state.editing;
}

function updateSelection() {
  const count = state.selectedFiles.length;
  elements.selectionPanel.classList.toggle("hidden", count === 0);
  elements.selectionCount.textContent = `${count} ${count === 1 ? "archivo" : "archivos"}`;
  elements.selectionHint.textContent = count >= 500 ? "Máximo de 500 archivos" : "Listos para procesar";
  setBusy(state.busy);
}

function updateStats() {
  elements.statTotal.textContent = state.summary.total || 0;
  elements.statComplete.textContent = state.summary.completos || 0;
  elements.statReview.textContent = (state.summary.revisar || 0) + (state.summary.errores || 0);
  elements.statSigned.textContent = state.summary.firmados || 0;
  elements.resultsSubtitle.textContent = state.records.length
    ? `${state.records.length} acuerdos guardados`
    : "Todavía no hay acuerdos procesados";
  setBusy(state.busy);
}

function extractionStatus(record) {
  if (record.estado === "COMPLETO") return { label: "Completo", className: "complete" };
  if (record.estado === "REVISAR") return { label: "Revisar", className: "review" };
  return { label: "Error", className: "error" };
}

function agreementStateClass(status) {
  if (status === "FIRMADO") return "signed";
  if (status === "ANULADO") return "cancelled";
  return "pending";
}

function supportLabels(record) {
  const support = record.patrocinio || {};
  const labels = [];
  if (support.financiamiento_total) labels.push("Financiamiento total");
  if (support.financiamiento_parcial) labels.push(`Financiamiento parcial${support.porcentaje_financiado ? ` ${support.porcentaje_financiado}%` : ""}`);
  if (support.anticipo_sueldo_honorarios) labels.push("Anticipo");
  if (support.cambio_modalidad_trabajo) labels.push("Cambio de modalidad");
  if (support.licencia_remunerada) labels.push("Licencia remunerada");
  if (support.licencia_no_remunerada) labels.push("Licencia sin remuneración");
  if (support.ajuste_horario_laboral) labels.push("Ajuste de horario");
  return labels;
}

function filteredRecords() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const filter = elements.statusFilter.value;
  return state.records.filter((record) => {
    const haystack = [
      record.docente?.nombre,
      record.docente?.cedula,
      record.docente?.carrera,
      record.capacitacion?.nombre,
      record.acuerdo?.codigo
    ].join(" ").toLowerCase();
    const statusMatches = !filter
      || record.estado === filter
      || (filter === "ERROR" && ["ERROR", "NO_ES_ACUERDO"].includes(record.estado));
    return statusMatches && (!query || haystack.includes(query));
  });
}

function renderTable() {
  const records = filteredRecords();
  elements.resultsBody.innerHTML = "";
  elements.emptyState.classList.toggle("hidden", records.length > 0);

  records.forEach((record) => {
    const status = extractionStatus(record);
    const support = supportLabels(record);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="status-pill ${status.className}">${status.label}</span></td>
      <td class="teacher-cell"><strong>${escapeHtml(value(record.docente?.nombre, record.archivo?.nombre || "Sin nombre"))}</strong><span>${escapeHtml(value(record.acuerdo?.codigo, record.archivo?.nombre || ""))}${record.correccion_manual ? " · Corregido" : ""}</span></td>
      <td>${escapeHtml(value(record.docente?.cedula, "—"))}</td>
      <td>${escapeHtml(value(record.capacitacion?.nombre))}</td>
      <td>${escapeHtml(value(record.acuerdo?.periodo, "—"))}</td>
      <td>${escapeHtml(support[0] || "No detectado")}${support.length > 1 ? `<span class="subtle">+${support.length - 1} adicional</span>` : ""}</td>
      <td><span class="agreement-state ${agreementStateClass(record.acuerdo?.estado_acuerdo)}">${escapeHtml(value(record.acuerdo?.estado_acuerdo, "Revisar"))}</span></td>
      <td><button class="detail-button" type="button">Ver</button></td>
    `;
    row.querySelector(".detail-button").addEventListener("click", () => openDrawer(record));
    elements.resultsBody.appendChild(row);
  });

  elements.visibleCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
}

function detailItem(label, content, full = false) {
  return `<div class="detail-item${full ? " full" : ""}"><span>${escapeHtml(label)}</span><p>${escapeHtml(value(content))}</p></div>`;
}

function uniqueIssues(record) {
  return [...new Set([...(record.campos_faltantes || []), ...(record.advertencias || [])].filter(Boolean))];
}

function renderDetail() {
  const record = state.currentRecord;
  if (!record) return;
  const status = extractionStatus(record);
  const support = supportLabels(record);
  const issues = uniqueIssues(record);
  elements.drawerTitle.textContent = value(record.docente?.nombre, record.archivo?.nombre || "Acuerdo");
  elements.drawerContent.innerHTML = `
    <div class="record-meta">
      <span class="status-pill ${status.className}">${status.label}</span>
      <span>${escapeHtml(record.archivo?.metodo_lectura || "")}</span>
      ${record.correccion_manual ? "<span class='manual-badge'>Corregido manualmente</span>" : ""}
    </div>

    <section class="detail-section">
      <h3>1. Datos del acuerdo</h3>
      <div class="detail-grid">
        ${detailItem("Código único", record.acuerdo?.codigo, true)}
        ${detailItem("Fecha de suscripción", record.acuerdo?.fecha_suscripcion)}
        ${detailItem("Periodo", record.acuerdo?.periodo)}
        ${detailItem("Versión de la plantilla", record.acuerdo?.version_plantilla || "No indicada")}
        ${detailItem("Estado del acuerdo", record.acuerdo?.estado_acuerdo)}
        ${detailItem("Archivo PDF final", record.archivo?.nombre, true)}
      </div>
    </section>

    <section class="detail-section">
      <h3>2. Datos del docente</h3>
      <div class="detail-grid">
        ${detailItem("ID o cédula", record.docente?.cedula)}
        ${detailItem("Cargo", record.docente?.cargo)}
        ${detailItem("Nombre completo", record.docente?.nombre, true)}
        ${detailItem("Carrera", record.docente?.carrera, true)}
      </div>
    </section>

    <section class="detail-section">
      <h3>3. Capacitación del plan</h3>
      <div class="link-card">
        <strong>${escapeHtml(value(record.capacitacion?.nombre))}</strong>
        <span>${record.capacitacion?.id_plan ? `ID: ${escapeHtml(record.capacitacion.id_plan)}` : "No vinculada con la primera pantalla"}</span>
      </div>
    </section>

    <section class="detail-section">
      <h3>4. Patrocinio seleccionado</h3>
      <div class="support-summary">
        ${support.length ? support.map((item) => `<span class="support-tag">${escapeHtml(item)}</span>`).join("") : "<span class='subtle'>No se detectó ninguna opción.</span>"}
      </div>
    </section>

    ${issues.length ? `<section class="detail-section review-section"><h3>5. Revisión</h3><ul class="issue-list">${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
  `;
}

function formField(label, field, current, options = {}) {
  const full = options.full === false ? "" : " full";
  if (options.select) {
    return `<label class="edit-field${full}"><span>${escapeHtml(label)}</span><select data-field="${escapeHtml(field)}">${options.select.map((item) => `<option value="${escapeHtml(item.value)}"${String(item.value) === String(current || "") ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>`;
  }
  return `<label class="edit-field${full}"><span>${escapeHtml(label)}</span><input data-field="${escapeHtml(field)}" type="${escapeHtml(options.type || "text")}" value="${escapeHtml(current || "")}"></label>`;
}

function checkboxField(label, field, checked) {
  return `<label class="check-card"><input data-check="${escapeHtml(field)}" type="checkbox"${checked ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`;
}

function planOptionRows(record) {
  const options = [{ value: "", label: "Sin vincular" }];
  state.planOptions.forEach((item) => {
    options.push({
      value: item.id,
      label: `${item.teacher} · ${item.name}${item.period ? ` · ${item.period}` : ""}`
    });
  });
  if (record.capacitacion?.id_plan && !options.some((item) => item.value === record.capacitacion.id_plan)) {
    options.push({ value: record.capacitacion.id_plan, label: record.capacitacion.id_plan });
  }
  return options;
}

function renderEdit() {
  const record = state.currentRecord;
  const support = record.patrocinio || {};
  const states = ["BORRADOR", "GENERADO", "PENDIENTE_FIRMA", "FIRMADO", "ANULADO", "REVISAR"]
    .map((item) => ({ value: item, label: item.replaceAll("_", " ") }));
  elements.drawerContent.innerHTML = `
    <div class="edit-notice">Corrige los campos necesarios y guarda.</div>
    <section class="detail-section"><h3>1. Datos del acuerdo</h3><div class="edit-grid">
      ${formField("Código único", "acuerdo.codigo", record.acuerdo?.codigo)}
      ${formField("Fecha de suscripción", "acuerdo.fecha_suscripcion", record.acuerdo?.fecha_suscripcion, { type: "date", full: false })}
      ${formField("Periodo", "acuerdo.periodo", record.acuerdo?.periodo, { type: "month", full: false })}
      ${formField("Versión de la plantilla", "acuerdo.version_plantilla", record.acuerdo?.version_plantilla, { full: false })}
      ${formField("Estado del acuerdo", "acuerdo.estado_acuerdo", record.acuerdo?.estado_acuerdo, { select: states, full: false })}
    </div></section>

    <section class="detail-section"><h3>2. Datos del docente</h3><div class="edit-grid">
      ${formField("ID o cédula", "docente.cedula", record.docente?.cedula, { full: false })}
      ${formField("Cargo", "docente.cargo", record.docente?.cargo, { full: false })}
      ${formField("Nombre completo", "docente.nombre", record.docente?.nombre)}
      ${formField("Carrera", "docente.carrera", record.docente?.carrera)}
    </div></section>

    <section class="detail-section"><h3>3. Capacitación del plan</h3><div class="edit-grid">
      ${formField("ID de la capacitación del plan", "capacitacion.id_plan", record.capacitacion?.id_plan, { select: planOptionRows(record) })}
      ${formField("Nombre de la capacitación", "capacitacion.nombre", record.capacitacion?.nombre)}
    </div></section>

    <section class="detail-section"><h3>4. Patrocinio</h3><div class="checkbox-grid">
      ${checkboxField("Financiamiento total", "financiamiento_total", support.financiamiento_total)}
      ${checkboxField("Financiamiento parcial", "financiamiento_parcial", support.financiamiento_parcial)}
      ${checkboxField("Anticipo de sueldo u honorarios", "anticipo_sueldo_honorarios", support.anticipo_sueldo_honorarios)}
      ${checkboxField("Cambio temporal de modalidad", "cambio_modalidad_trabajo", support.cambio_modalidad_trabajo)}
      ${checkboxField("Licencia con remuneración", "licencia_remunerada", support.licencia_remunerada)}
      ${checkboxField("Licencia sin remuneración", "licencia_no_remunerada", support.licencia_no_remunerada)}
      ${checkboxField("Ajuste de horario laboral", "ajuste_horario_laboral", support.ajuste_horario_laboral)}
    </div><div class="edit-grid percentage-row">${formField("Porcentaje financiado", "patrocinio.porcentaje_financiado", support.porcentaje_financiado, { type: "number", full: false })}</div></section>
  `;

  const trainingSelect = elements.drawerContent.querySelector('[data-field="capacitacion.id_plan"]');
  const trainingName = elements.drawerContent.querySelector('[data-field="capacitacion.nombre"]');
  trainingSelect.addEventListener("change", () => {
    const selected = state.planOptions.find((item) => item.id === trainingSelect.value);
    if (selected && !trainingName.value.trim()) trainingName.value = selected.name;
  });
}

function inputValue(field) {
  return elements.drawerContent.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
}
function checkValue(field) {
  return Boolean(elements.drawerContent.querySelector(`[data-check="${field}"]`)?.checked);
}

function collectEdit() {
  return {
    ...clone(state.currentRecord),
    acuerdo: {
      codigo: inputValue("acuerdo.codigo"),
      fecha_suscripcion: inputValue("acuerdo.fecha_suscripcion"),
      periodo: inputValue("acuerdo.periodo"),
      version_plantilla: inputValue("acuerdo.version_plantilla"),
      estado_acuerdo: inputValue("acuerdo.estado_acuerdo")
    },
    docente: {
      cedula: inputValue("docente.cedula"),
      nombre: inputValue("docente.nombre"),
      carrera: inputValue("docente.carrera"),
      cargo: inputValue("docente.cargo")
    },
    capacitacion: {
      id_plan: inputValue("capacitacion.id_plan"),
      nombre: inputValue("capacitacion.nombre")
    },
    patrocinio: {
      financiamiento_total: checkValue("financiamiento_total"),
      financiamiento_parcial: checkValue("financiamiento_parcial"),
      porcentaje_financiado: inputValue("patrocinio.porcentaje_financiado"),
      anticipo_sueldo_honorarios: checkValue("anticipo_sueldo_honorarios"),
      cambio_modalidad_trabajo: checkValue("cambio_modalidad_trabajo"),
      licencia_remunerada: checkValue("licencia_remunerada"),
      licencia_no_remunerada: checkValue("licencia_no_remunerada"),
      ajuste_horario_laboral: checkValue("ajuste_horario_laboral")
    }
  };
}

function setEditing(editing) {
  state.editing = Boolean(editing);
  elements.editButton.classList.toggle("hidden", state.editing);
  elements.saveButton.classList.toggle("hidden", !state.editing);
  elements.cancelButton.classList.toggle("hidden", !state.editing);
  if (state.editing) renderEdit();
  else renderDetail();
  setBusy(state.busy);
}

function openDrawer(record) {
  state.currentRecord = record;
  state.editing = false;
  elements.drawerBackdrop.classList.remove("hidden");
  elements.detailDrawer.classList.add("open");
  elements.detailDrawer.setAttribute("aria-hidden", "false");
  setEditing(false);
}

function closeDrawer(force = false) {
  if (state.editing && !force && !window.confirm("¿Salir sin guardar los cambios?")) return;
  state.currentRecord = null;
  state.editing = false;
  elements.drawerBackdrop.classList.add("hidden");
  elements.detailDrawer.classList.remove("open");
  elements.detailDrawer.setAttribute("aria-hidden", "true");
}

async function saveCurrent() {
  if (!state.currentRecord || !state.editing || state.busy) return;
  setBusy(true);
  try {
    const result = await api.update(collectEdit());
    state.records = result.records || state.records;
    state.summary = result.summary || state.summary;
    state.planOptions = result.planOptions || state.planOptions;
    state.currentRecord = result.record;
    updateStats();
    renderTable();
    setEditing(false);
    toast("Acuerdo actualizado.", "success");
  } catch (error) {
    toast(error.message || "No se pudo guardar el acuerdo.", "error");
  } finally {
    setBusy(false);
  }
}

function showProgress(progress) {
  if (progress.scope && progress.scope !== "agreements") return;
  elements.progressCard.classList.remove("hidden");
  const percent = Math.max(0, Math.min(100, Number(progress.percent ?? progress.overallPercent ?? 0)));
  elements.progressBar.style.width = `${percent}%`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressFile.textContent = progress.fileName || "";
  elements.progressMessage.textContent = progress.message || "Procesando...";
  elements.progressTitle.textContent = ["ocr-page", "ocr-progress"].includes(progress.phase) ? "Reconociendo texto" : "Procesando acuerdos";
  if (progress.phase === "complete") {
    elements.progressTitle.textContent = "Listo";
    window.setTimeout(() => elements.progressCard.classList.add("hidden"), 1700);
  }
}

async function loadRecords() {
  try {
    const result = await api.list();
    state.records = result.records || [];
    state.planOptions = result.planOptions || [];
    state.summary = result.summary || state.summary;
    updateStats();
    renderTable();
  } catch (error) {
    toast(error.message || "No se pudieron cargar los acuerdos.", "error");
  }
}

async function selectFiles() {
  try {
    const result = await api.selectFiles();
    if (result.canceled) return;
    state.selectedFiles = result.filePaths || [];
    updateSelection();
  } catch (error) { toast(error.message || "No se pudieron seleccionar los archivos.", "error"); }
}

async function selectFolder() {
  try {
    const result = await api.selectFolder();
    if (result.canceled) return;
    state.selectedFiles = result.filePaths || [];
    updateSelection();
    if (result.truncated) toast("Se cargaron los primeros 500 PDF.");
    if (!state.selectedFiles.length) toast("La carpeta no contiene PDF.", "error");
  } catch (error) { toast(error.message || "No se pudo leer la carpeta.", "error"); }
}

async function processSelection() {
  if (!state.selectedFiles.length || state.busy) return;
  setBusy(true);
  elements.progressCard.classList.remove("hidden");
  try {
    const result = await api.process(state.selectedFiles);
    state.selectedFiles = [];
    updateSelection();
    const latest = await api.list();
    state.records = latest.records || [];
    state.planOptions = latest.planOptions || [];
    state.summary = latest.summary || result.summary || state.summary;
    updateStats();
    renderTable();
    toast(`${result.processed} acuerdos procesados.`, "success");
  } catch (error) {
    toast(error.message || "No se pudo completar el procesamiento.", "error");
  } finally { setBusy(false); }
}

async function exportData(format) {
  try {
    const result = await api.export(format);
    if (!result.canceled) toast(`${format.toUpperCase()} guardado.`, "success");
  } catch (error) { toast(error.message || "No se pudo exportar.", "error"); }
}

async function clearData() {
  if (!state.records.length || state.busy || !window.confirm("¿Borrar todos los acuerdos guardados?")) return;
  try {
    const result = await api.clear();
    state.records = result.records || [];
    state.summary = result.summary || { total: 0, completos: 0, revisar: 0, errores: 0, firmados: 0 };
    updateStats();
    renderTable();
    toast("Acuerdos borrados.", "success");
  } catch (error) { toast(error.message || "No se pudieron borrar los datos.", "error"); }
}

function bindEvents() {
  elements.filesButton.addEventListener("click", selectFiles);
  elements.folderButton.addEventListener("click", selectFolder);
  elements.clearSelectionButton.addEventListener("click", () => { state.selectedFiles = []; updateSelection(); });
  elements.processButton.addEventListener("click", processSelection);
  elements.searchInput.addEventListener("input", renderTable);
  elements.statusFilter.addEventListener("change", renderTable);
  elements.excelButton.addEventListener("click", () => exportData("xlsx"));
  elements.jsonButton.addEventListener("click", () => exportData("json"));
  elements.clearDataButton.addEventListener("click", clearData);
  elements.closeDrawerButton.addEventListener("click", () => closeDrawer());
  elements.drawerBackdrop.addEventListener("click", () => closeDrawer());
  elements.editButton.addEventListener("click", () => setEditing(true));
  elements.cancelButton.addEventListener("click", () => setEditing(false));
  elements.saveButton.addEventListener("click", saveCurrent);
  elements.openPdfButton.addEventListener("click", async () => {
    try { if (state.currentRecord?.archivo?.ruta) await api.openFile(state.currentRecord.archivo.ruta); }
    catch (error) { toast(error.message || "No se pudo abrir el PDF.", "error"); }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDrawer(); });
  api.onProgress(showProgress);
}

async function initialize() {
  cacheElements();
  bindEvents();
  setBusy(false);
  try {
    const info = await api.getAppInfo();
    elements.versionLabel.textContent = `v${info.version}`;
  } catch (_error) { /* conserva la versión visible */ }
  await loadRecords();
}

document.addEventListener("DOMContentLoaded", initialize, { once: true });
