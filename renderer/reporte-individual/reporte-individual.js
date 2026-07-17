/* =========================================================
Nombre completo: reporte-individual.js
Ruta o ubicación: /renderer/reporte-individual/reporte-individual.js
Función o funciones:
- Controlar la pantalla Reporte Individual.
- Consultar la base, seleccionar docentes y preparar el borrador del reporte.
========================================================= */
"use strict";

(function initializeIndividualReportPage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  const components = windowObject.IndividualReportComponents || {};
  const views = windowObject.IndividualReportViews || {};
  let teachers = [];
  let selectedKey = "";
  let selectedReport = null;
  let loading = false;

  const elements = {
    search: documentObject.getElementById("individualReportSearch"),
    statusFilter: documentObject.getElementById("individualReportStatus"),
    apply: documentObject.getElementById("btnApplyIndividualFilters"),
    refresh: documentObject.getElementById("btnRefreshIndividualReport"),
    prepare: documentObject.getElementById("btnPrepareIndividualReport"),
    statusBox: documentObject.getElementById("individualReportStatusBox"),
    list: documentObject.getElementById("individualReportTeacherList"),
    count: documentObject.getElementById("individualReportCount"),
    detail: documentObject.getElementById("individualReportDetail"),
    preview: documentObject.getElementById("individualReportPreview"),
    summaryTeachers: documentObject.getElementById("reportSummaryTeachers"),
    summaryComplete: documentObject.getElementById("reportSummaryComplete"),
    summaryWarnings: documentObject.getElementById("reportSummaryWarnings"),
    summaryBlocked: documentObject.getElementById("reportSummaryBlocked")
  };

  function setStatus(message, type = "info") {
    elements.statusBox.className = ui.statusClass(type);
    elements.statusBox.textContent = message;
  }

  function setBusy(value) {
    loading = Boolean(value);
    elements.apply.disabled = loading;
    elements.refresh.disabled = loading;
    elements.prepare.disabled = loading || !selectedReport?.puedeGenerar;
  }

  function updateSummary() {
    elements.summaryTeachers.textContent = String(teachers.length);
    elements.summaryComplete.textContent = String(teachers.filter((row) => row.estadoGeneral === "COMPLETO").length);
    elements.summaryWarnings.textContent = String(teachers.filter((row) => row.estadoGeneral === "GENERABLE_CON_ADVERTENCIAS").length);
    elements.summaryBlocked.textContent = String(teachers.filter((row) => row.estadoGeneral === "NO_GENERABLE").length);
    elements.count.textContent = `${teachers.length} registro(s)`;
  }

  function renderList() {
    views.renderTeacherList(elements.list, teachers, selectedKey, selectTeacher);
    updateSummary();
  }

  async function loadTeachers(preserveSelection = true) {
    if (loading) return;
    setBusy(true);
    setStatus("Consultando los Planes Individuales y sus relaciones...", "info");
    try {
      const filters = components.readFilters(documentObject);
      const result = await windowObject.documentAppAPI.listIndividualReportTeachers(filters);
      teachers = Array.isArray(result?.teachers) ? result.teachers : [];
      if (!preserveSelection || !teachers.some((row) => row.key === selectedKey)) {
        selectedKey = teachers[0]?.key || "";
        selectedReport = null;
      }
      renderList();
      if (selectedKey) await selectTeacher(selectedKey, false, true);
      else {
        views.renderTeacherDetail(elements.detail, null);
        views.renderReportPreview(elements.preview, null);
      }
      setStatus(`Consulta terminada: ${teachers.length} docente(s) encontrado(s).`, teachers.length ? "success" : "warning");
    } catch (error) {
      teachers = [];
      selectedKey = "";
      selectedReport = null;
      renderList();
      views.renderTeacherDetail(elements.detail, null);
      setStatus(`No se pudo consultar el Reporte Individual: ${error.message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  async function selectTeacher(key, updateStatus = true, allowWhileLoading = false) {
    if (!key || (loading && !allowWhileLoading)) return;
    selectedKey = key;
    renderList();
    views.renderReportPreview(elements.preview, null);
    if (updateStatus) setStatus("Construyendo el cruce documental del docente...", "info");
    try {
      const result = await windowObject.documentAppAPI.getIndividualReport(key);
      selectedReport = result?.report || null;
      views.renderTeacherDetail(elements.detail, selectedReport);
      elements.prepare.disabled = loading || !selectedReport?.puedeGenerar;
      if (updateStatus) {
        setStatus(
          selectedReport?.puedeGenerar
            ? "El reporte puede prepararse. Revisa las advertencias de comprobación."
            : "El reporte está bloqueado porque faltan requisitos individuales.",
          selectedReport?.puedeGenerar ? (selectedReport.validacionCompleta ? "success" : "warning") : "danger"
        );
      }
    } catch (error) {
      selectedReport = null;
      views.renderTeacherDetail(elements.detail, null);
      elements.prepare.disabled = true;
      setStatus(`No se pudo cargar el docente: ${error.message}`, "danger");
    }
  }

  async function prepareReport() {
    if (!selectedKey || !selectedReport?.puedeGenerar || loading) return;
    setBusy(true);
    setStatus("Preparando el borrador estructurado del reporte...", "info");
    try {
      const result = await windowObject.documentAppAPI.prepareIndividualReport(selectedKey);
      views.renderReportPreview(elements.preview, result);
      setStatus(result.message || "Reporte preparado.", result.ok ? (result.validation?.warnings?.length ? "warning" : "success") : "danger");
    } catch (error) {
      views.renderReportPreview(elements.preview, { ok: false, message: error.message });
      setStatus(`No se pudo preparar el reporte: ${error.message}`, "danger");
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    elements.apply.addEventListener("click", () => loadTeachers(false));
    elements.refresh.addEventListener("click", () => loadTeachers(true));
    elements.prepare.addEventListener("click", prepareReport);
    elements.search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") loadTeachers(false);
    });
    elements.statusFilter.addEventListener("change", () => loadTeachers(false));
  }

  function initialize() {
    bindEvents();
    loadTeachers(false);
  }

  if (documentObject.readyState === "loading") {
    documentObject.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(window, document);
