"use strict";

const api = window.plansAPI;
const FIXED_DEDICATION = "Tiempo Completo";

const state = {
  selectedFiles: [],
  records: [],
  summary: { total: 0, completos: 0, revisar: 0, errores: 0, capacitaciones: 0 },
  busy: false,
  currentRecord: null,
  editDraft: null,
  editing: false
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
    "drawerTitle", "drawerContent", "closeDrawerButton", "openPdfButton", "editPlanButton",
    "savePlanButton", "cancelEditButton", "toastStack"
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function splitLines(value) {
  return String(value || "")
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function problemFor(record, path) {
  return record?.problemas_campos?.[path] || null;
}

function hasProblemPrefix(record, prefix) {
  return Object.keys(record?.problemas_campos || {}).some((path) => path === prefix || path.startsWith(`${prefix}.`));
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
  elements.editPlanButton.disabled = state.busy || !state.currentRecord;
  elements.savePlanButton.disabled = state.busy || !state.editing;
  elements.cancelEditButton.disabled = state.busy || !state.editing;
  elements.openPdfButton.disabled = state.busy || !state.currentRecord?.archivo?.ruta;
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
    const problemCount = Object.keys(record.problemas_campos || {}).length;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="status-pill ${status.className}">${status.label}</span></td>
      <td class="teacher-cell">
        <strong>${escapeHtml(displayValue(record.docente?.nombre, record.archivo?.nombre || "Sin nombre"))}</strong>
        <span>${escapeHtml(displayValue(record.docente?.codigo_documento, record.archivo?.nombre || ""))}${record.correccion_manual ? " · Corregido" : ""}</span>
      </td>
      <td>${escapeHtml(displayValue(record.docente?.carrera))}</td>
      <td>${escapeHtml(displayValue(record.docente?.periodo_plan, "—"))}</td>
      <td>${record.capacitaciones?.length || 0}</td>
      <td><span class="method-pill">${escapeHtml(displayValue(record.archivo?.metodo_lectura, "—"))}</span></td>
      <td>
        ${problemCount ? `<span class="problem-count" title="${problemCount} campos por corregir">${problemCount}</span>` : ""}
        <button class="detail-button" type="button">Ver</button>
      </td>
    `;
    row.querySelector(".detail-button").addEventListener("click", () => openDrawer(record));
    elements.resultsBody.appendChild(row);
  });

  elements.visibleCount.textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
}

function detailItem(label, value, path, full = false, record = state.currentRecord) {
  const problem = problemFor(record, path);
  return `
    <div class="detail-item${full ? " full" : ""}${problem ? " field-problem" : ""}">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(displayValue(value))}</p>
      ${problem ? `<small>${escapeHtml(problem.message)}</small>` : ""}
    </div>
  `;
}

function trainingValue(label, value, path, record) {
  const problem = problemFor(record, path);
  return `
    <div class="training-value${problem ? " field-problem-inline" : ""}">
      <span>${escapeHtml(label)}</span>
      <p>${escapeHtml(displayValue(value))}</p>
      ${problem ? `<small>${escapeHtml(problem.message)}</small>` : ""}
    </div>
  `;
}

function trainingHtml(training, index, record) {
  const base = `capacitaciones.${index}`;
  const cardProblem = hasProblemPrefix(record, base);
  return `
    <article class="training-card${cardProblem ? " training-problem" : ""}">
      <div class="training-head">
        <strong>Capacitación ${index + 1}: ${escapeHtml(displayValue(training.nombre))}</strong>
        <span>${escapeHtml(displayValue(training.horas, "0"))} h</span>
      </div>
      <div class="training-detail ordered">
        ${trainingValue("Nombre", training.nombre, `${base}.nombre`, record)}
        ${trainingValue("Horas", training.horas ? `${training.horas} h` : "", `${base}.horas`, record)}
        ${trainingValue("Fecha de inicio", training.fecha_inicio_propuesta, `${base}.fecha_inicio_propuesta`, record)}
        ${trainingValue("Fecha de finalización", training.fecha_fin_propuesta, `${base}.fecha_fin_propuesta`, record)}
        ${trainingValue("Tipo", training.tipo, `${base}.tipo`, record)}
        ${trainingValue("Actividades teóricas", listText(training.actividades_teoricas), `${base}.actividades_teoricas`, record)}
        ${trainingValue("Actividades prácticas", listText(training.actividades_practicas), `${base}.actividades_practicas`, record)}
        ${trainingValue("Impacto esperado", training.impacto_esperado, `${base}.impacto_esperado`, record)}
        ${trainingValue("Visión a largo plazo", training.vision_largo_plazo, `${base}.vision_largo_plazo`, record)}
      </div>
    </article>
  `;
}

function uniqueIssues(record) {
  const structured = Object.values(record.problemas_campos || {}).map((problem) => problem.message);
  return [...new Set([...structured, ...(record.advertencias || [])].filter(Boolean))];
}

function renderDetailView() {
  const record = state.currentRecord;
  if (!record) return;
  const issues = uniqueIssues(record);
  const trainings = record.capacitaciones || [];
  const status = statusInfo(record);
  const missingTrainings = problemFor(record, "capacitaciones");
  elements.drawerTitle.textContent = displayValue(record.docente?.nombre, record.archivo?.nombre || "Plan docente");

  elements.drawerContent.innerHTML = `
    <div class="record-meta">
      <span class="status-pill ${status.className}">${status.label}</span>
      <span>${escapeHtml(record.archivo?.metodo_lectura || "")}</span>
      ${record.correccion_manual ? "<span class='manual-badge'>Corregido manualmente</span>" : ""}
    </div>

    ${issues.length ? `<div class="problem-guide">Los campos en rojo necesitan corrección.</div>` : ""}

    <section class="detail-section">
      <h3>1. Datos del docente</h3>
      <div class="detail-grid">
        ${detailItem("Nombre del docente", record.docente?.nombre, "docente.nombre", true, record)}
        ${detailItem("Carrera", record.docente?.carrera, "docente.carrera", true, record)}
        ${detailItem("Tiempo de dedicación", FIXED_DEDICATION, "docente.tiempo_dedicacion", false, record)}
        ${detailItem("Nivel académico actual", record.docente?.nivel_academico_actual, "docente.nivel_academico_actual", false, record)}
        ${detailItem("Código del documento", record.docente?.codigo_documento, "docente.codigo_documento", true, record)}
        ${detailItem("Periodo del plan", record.docente?.periodo_plan, "docente.periodo_plan", true, record)}
      </div>
    </section>

    <section class="detail-section">
      <h3>2. Diagnóstico del docente</h3>
      <div class="detail-grid">
        ${detailItem("Capacitación realizada en los últimos 12 meses", record.diagnostico?.capacitacion_12_meses, "diagnostico.capacitacion_12_meses", true, record)}
        ${detailItem("Avances disciplinares aplicados en clases", record.diagnostico?.avances_aplicados, "diagnostico.avances_aplicados", true, record)}
        ${detailItem("Nivel de comodidad con nuevas metodologías", record.diagnostico?.comodidad_metodologias, "diagnostico.comodidad_metodologias", true, record)}
        ${detailItem("Estrategias pedagógicas utilizadas", record.diagnostico?.estrategias_pedagogicas, "diagnostico.estrategias_pedagogicas", true, record)}
        ${detailItem("Herramientas tecnológicas utilizadas", record.diagnostico?.herramientas_tecnologicas, "diagnostico.herramientas_tecnologicas", true, record)}
        ${detailItem("Formación académica adicional necesaria", record.diagnostico?.formacion_adicional, "diagnostico.formacion_adicional", true, record)}
        ${detailItem("Tipo de formación requerida", record.diagnostico?.tipo_formacion, "diagnostico.tipo_formacion", true, record)}
      </div>
    </section>

    <section class="detail-section${missingTrainings ? " section-problem" : ""}">
      <h3>3. Capacitaciones propuestas (${trainings.length})</h3>
      ${trainings.length
        ? trainings.map((training, index) => trainingHtml(training, index, record)).join("")
        : `<div class="detail-item full field-problem"><p>No se encontraron capacitaciones.</p><small>${escapeHtml(missingTrainings?.message || "Agrega al menos una capacitación.")}</small></div>`}
    </section>

    ${issues.length ? `
      <section class="detail-section review-section">
        <h3>4. Revisión</h3>
        <ul class="issue-list">${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>
      </section>
    ` : ""}
  `;
}

function formField(label, field, value, options = {}) {
  const fullClass = options.full === false ? "" : " full";
  const type = options.type || "text";
  const problem = options.problem || null;
  const problemClass = problem ? " field-problem" : "";
  const readonly = options.readonly ? " readonly" : "";
  const fixedClass = options.readonly ? " fixed-field" : "";
  if (options.textarea) {
    return `
      <label class="edit-field${fullClass}${problemClass}${fixedClass}">
        <span>${escapeHtml(label)}</span>
        <textarea data-field="${escapeHtml(field)}" rows="${options.rows || 3}"${readonly}>${escapeHtml(value || "")}</textarea>
        ${problem ? `<small>${escapeHtml(problem.message)}</small>` : ""}
      </label>
    `;
  }
  return `
    <label class="edit-field${fullClass}${problemClass}${fixedClass}">
      <span>${escapeHtml(label)}</span>
      <input data-field="${escapeHtml(field)}" type="${escapeHtml(type)}" value="${escapeHtml(value || "")}"${readonly} />
      ${problem ? `<small>${escapeHtml(problem.message)}</small>` : ""}
    </label>
  `;
}

function trainingEditHtml(training, index, record) {
  const base = `capacitaciones.${index}`;
  const cardProblem = hasProblemPrefix(record, base);
  const issue = (field) => problemFor(record, `${base}.${field}`);
  return `
    <article class="training-edit-card${cardProblem ? " training-problem" : ""}" data-training-index="${index}">
      <div class="training-edit-head">
        <strong>Capacitación ${index + 1}${cardProblem ? " · Revisar" : ""}</strong>
        <button class="text-button danger" type="button" data-remove-training="${index}">Eliminar</button>
      </div>
      <div class="edit-grid">
        ${formField("Nombre", "nombre", training.nombre, { problem: issue("nombre") })}
        ${formField("Horas", "horas", training.horas || "", { type: "number", full: false, problem: issue("horas") })}
        ${formField("Tipo", "tipo", training.tipo || "", { full: false, problem: issue("tipo") })}
        ${formField("Fecha de inicio", "fecha_inicio_propuesta", training.fecha_inicio_propuesta || "", { full: false, problem: issue("fecha_inicio_propuesta") })}
        ${formField("Fecha de finalización", "fecha_fin_propuesta", training.fecha_fin_propuesta || "", { full: false, problem: issue("fecha_fin_propuesta") })}
        ${formField("Actividades teóricas (una por línea)", "actividades_teoricas", (training.actividades_teoricas || []).join("\n"), { textarea: true, problem: issue("actividades_teoricas") })}
        ${formField("Actividades prácticas (una por línea)", "actividades_practicas", (training.actividades_practicas || []).join("\n"), { textarea: true, problem: issue("actividades_practicas") })}
        ${formField("Impacto esperado", "impacto_esperado", training.impacto_esperado || "", { textarea: true, problem: issue("impacto_esperado") })}
        ${formField("Visión a largo plazo", "vision_largo_plazo", training.vision_largo_plazo || "", { textarea: true, problem: issue("vision_largo_plazo") })}
      </div>
    </article>
  `;
}

function renderEditForm() {
  const record = state.editDraft;
  if (!record) return;
  record.docente = record.docente || {};
  record.docente.tiempo_dedicacion = FIXED_DEDICATION;
  const trainings = record.capacitaciones || [];
  const issue = (path) => problemFor(record, path);
  const missingTrainings = issue("capacitaciones");
  elements.drawerTitle.textContent = displayValue(record.docente?.nombre, "Editar plan");
  elements.drawerContent.innerHTML = `
    <div class="edit-notice${Object.keys(record.problemas_campos || {}).length ? " warning" : ""}">
      ${Object.keys(record.problemas_campos || {}).length
        ? "Corrige los campos marcados en rojo y pulsa Guardar."
        : "Puedes corregir los datos y pulsar Guardar."}
    </div>

    <section class="detail-section">
      <h3>1. Datos del docente</h3>
      <div class="edit-grid">
        ${formField("Nombre del docente", "docente.nombre", record.docente?.nombre, { problem: issue("docente.nombre") })}
        ${formField("Carrera", "docente.carrera", record.docente?.carrera, { problem: issue("docente.carrera") })}
        ${formField("Tiempo de dedicación", "docente.tiempo_dedicacion", FIXED_DEDICATION, { full: false, readonly: true })}
        ${formField("Nivel académico actual", "docente.nivel_academico_actual", record.docente?.nivel_academico_actual, { full: false, problem: issue("docente.nivel_academico_actual") })}
        ${formField("Código del documento", "docente.codigo_documento", record.docente?.codigo_documento, { problem: issue("docente.codigo_documento") })}
        ${formField("Periodo del plan", "docente.periodo_plan", record.docente?.periodo_plan, { type: "month", problem: issue("docente.periodo_plan") })}
      </div>
    </section>

    <section class="detail-section">
      <h3>2. Diagnóstico del docente</h3>
      <div class="edit-grid">
        ${formField("Capacitación realizada en los últimos 12 meses", "diagnostico.capacitacion_12_meses", record.diagnostico?.capacitacion_12_meses, { textarea: true, problem: issue("diagnostico.capacitacion_12_meses") })}
        ${formField("Avances disciplinares aplicados en clases", "diagnostico.avances_aplicados", record.diagnostico?.avances_aplicados, { textarea: true, problem: issue("diagnostico.avances_aplicados") })}
        ${formField("Nivel de comodidad con nuevas metodologías", "diagnostico.comodidad_metodologias", record.diagnostico?.comodidad_metodologias, { textarea: true, problem: issue("diagnostico.comodidad_metodologias") })}
        ${formField("Estrategias pedagógicas utilizadas", "diagnostico.estrategias_pedagogicas", record.diagnostico?.estrategias_pedagogicas, { textarea: true, problem: issue("diagnostico.estrategias_pedagogicas") })}
        ${formField("Herramientas tecnológicas utilizadas", "diagnostico.herramientas_tecnologicas", record.diagnostico?.herramientas_tecnologicas, { textarea: true, problem: issue("diagnostico.herramientas_tecnologicas") })}
        ${formField("Formación académica adicional necesaria", "diagnostico.formacion_adicional", record.diagnostico?.formacion_adicional, { textarea: true, problem: issue("diagnostico.formacion_adicional") })}
        ${formField("Tipo de formación requerida", "diagnostico.tipo_formacion", record.diagnostico?.tipo_formacion, { textarea: true, problem: issue("diagnostico.tipo_formacion") })}
      </div>
    </section>

    <section class="detail-section${missingTrainings ? " section-problem" : ""}">
      <div class="section-heading-row">
        <h3>3. Capacitaciones propuestas (${trainings.length})</h3>
        <button class="button secondary compact" id="addTrainingButton" type="button">Agregar</button>
      </div>
      ${missingTrainings ? `<small class="section-error">${escapeHtml(missingTrainings.message)}</small>` : ""}
      <div id="trainingEditList">
        ${trainings.length ? trainings.map((training, index) => trainingEditHtml(training, index, record)).join("") : "<div class='edit-empty field-problem'>No hay capacitaciones. Pulsa Agregar.</div>"}
      </div>
    </section>
  `;

  elements.drawerContent.querySelector("#addTrainingButton").addEventListener("click", () => {
    syncDraftFromForm();
    state.editDraft.capacitaciones.push({
      orden: state.editDraft.capacitaciones.length + 1,
      nombre: "",
      horas: 0,
      fecha_inicio_propuesta: "",
      fecha_fin_propuesta: "",
      tipo: "",
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: ""
    });
    renderEditForm();
  });

  elements.drawerContent.querySelectorAll("[data-remove-training]").forEach((button) => {
    button.addEventListener("click", () => {
      syncDraftFromForm();
      const index = Number(button.dataset.removeTraining);
      state.editDraft.capacitaciones.splice(index, 1);
      renderEditForm();
    });
  });
}

function fieldValue(field) {
  return elements.drawerContent.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
}

function syncDraftFromForm() {
  if (!state.editing || !state.editDraft) return;
  state.editDraft.docente = {
    nombre: fieldValue("docente.nombre"),
    carrera: fieldValue("docente.carrera"),
    tiempo_dedicacion: FIXED_DEDICATION,
    nivel_academico_actual: fieldValue("docente.nivel_academico_actual"),
    codigo_documento: fieldValue("docente.codigo_documento"),
    periodo_plan: fieldValue("docente.periodo_plan")
  };
  state.editDraft.diagnostico = {
    capacitacion_12_meses: fieldValue("diagnostico.capacitacion_12_meses"),
    avances_aplicados: fieldValue("diagnostico.avances_aplicados"),
    comodidad_metodologias: fieldValue("diagnostico.comodidad_metodologias"),
    estrategias_pedagogicas: fieldValue("diagnostico.estrategias_pedagogicas"),
    herramientas_tecnologicas: fieldValue("diagnostico.herramientas_tecnologicas"),
    formacion_adicional: fieldValue("diagnostico.formacion_adicional"),
    tipo_formacion: fieldValue("diagnostico.tipo_formacion")
  };
  state.editDraft.capacitaciones = [...elements.drawerContent.querySelectorAll(".training-edit-card")].map((card, index) => {
    const get = (name) => card.querySelector(`[data-field="${name}"]`)?.value.trim() || "";
    return {
      orden: index + 1,
      nombre: get("nombre"),
      horas: Number(get("horas") || 0),
      fecha_inicio_propuesta: get("fecha_inicio_propuesta"),
      fecha_fin_propuesta: get("fecha_fin_propuesta"),
      tipo: get("tipo"),
      actividades_teoricas: splitLines(get("actividades_teoricas")),
      actividades_practicas: splitLines(get("actividades_practicas")),
      impacto_esperado: get("impacto_esperado"),
      vision_largo_plazo: get("vision_largo_plazo")
    };
  });
}

function setEditMode(editing) {
  state.editing = Boolean(editing);
  elements.editPlanButton.classList.toggle("hidden", state.editing);
  elements.savePlanButton.classList.toggle("hidden", !state.editing);
  elements.cancelEditButton.classList.toggle("hidden", !state.editing);
  if (state.editing) {
    state.editDraft = clone(state.currentRecord);
    renderEditForm();
  } else {
    state.editDraft = null;
    renderDetailView();
  }
  setBusy(state.busy);
}

function openDrawer(record) {
  state.currentRecord = record;
  state.editDraft = null;
  state.editing = false;
  elements.drawerBackdrop.classList.remove("hidden");
  elements.detailDrawer.classList.add("open");
  elements.detailDrawer.setAttribute("aria-hidden", "false");
  elements.editPlanButton.classList.remove("hidden");
  elements.savePlanButton.classList.add("hidden");
  elements.cancelEditButton.classList.add("hidden");
  renderDetailView();
  setBusy(state.busy);
}

function closeDrawer(force = false) {
  if (state.editing && !force && !window.confirm("¿Salir sin guardar los cambios?")) return;
  state.currentRecord = null;
  state.editDraft = null;
  state.editing = false;
  elements.drawerBackdrop.classList.add("hidden");
  elements.detailDrawer.classList.remove("open");
  elements.detailDrawer.setAttribute("aria-hidden", "true");
}

async function saveEdit() {
  if (!state.editing || !state.editDraft || state.busy) return;
  syncDraftFromForm();
  setBusy(true);
  try {
    const result = await api.update(state.editDraft);
    state.records = result.records || state.records;
    state.summary = result.summary || state.summary;
    state.currentRecord = result.record;
    updateStats();
    renderTable();
    setEditMode(false);
    const remaining = Object.keys(result.record?.problemas_campos || {}).length;
    toast(remaining ? `Guardado. Aún faltan ${remaining} campos por corregir.` : "Correcciones guardadas.", remaining ? "" : "success");
  } catch (error) {
    toast(error.message || "No se pudieron guardar las correcciones.", "error");
  } finally {
    setBusy(false);
  }
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
    const latest = await api.list();
    state.records = latest.records || state.records;
    state.summary = latest.summary || result.summary || state.summary;
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

async function openCurrentPdf() {
  try {
    if (state.currentRecord?.archivo?.ruta) await api.openFile(state.currentRecord.archivo.ruta);
  } catch (error) {
    toast(error.message || "No se pudo abrir el PDF.", "error");
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
  elements.closeDrawerButton.addEventListener("click", () => closeDrawer());
  elements.drawerBackdrop.addEventListener("click", () => closeDrawer());
  elements.openPdfButton.addEventListener("click", openCurrentPdf);
  elements.editPlanButton.addEventListener("click", () => setEditMode(true));
  elements.cancelEditButton.addEventListener("click", () => setEditMode(false));
  elements.savePlanButton.addEventListener("click", saveEdit);
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
