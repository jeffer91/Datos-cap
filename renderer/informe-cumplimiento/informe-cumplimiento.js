"use strict";

(function initializeCompliancePage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  let loading = false;
  const element = (id) => documentObject.getElementById(id);
  const els = {
    status: element("complianceStatusBox"), state: element("complianceAnalysisState"), metrics: element("complianceMetrics"),
    nav: element("complianceSectionNav"), sections: element("complianceSections"), alerts: element("complianceAlerts"), preview: element("compliancePreview"),
    documentChart: element("chartDocumentaryCoverage"), hoursChart: element("chartHours"), careersChart: element("chartCareers"), gapsChart: element("chartGaps"),
    apply: element("btnApplyComplianceFilters"), refresh: element("btnRefreshCompliance"), internal: element("btnRunInternalAnalysis"), ai: element("btnRefineComplianceAi"), prepare: element("btnPrepareCompliance")
  };
  function filters() { return { period: element("compliancePeriod").value, career: element("complianceCareer").value, modality: element("complianceModality").value, query: element("complianceQuery").value }; }
  function setStatus(message, type = "info") { els.status.className = ui.statusClass(type); els.status.textContent = message; }
  function setBusy(value) { loading = Boolean(value); [els.apply, els.refresh, els.internal, els.ai, els.prepare].forEach((button) => { button.disabled = loading; }); }
  function fillSelect(id, values, label) {
    const select = element(id); const current = select.value;
    select.innerHTML = `<option value="">${ui.escapeHtml(label)}</option>` + (values || []).map((value) => `<option value="${ui.escapeHtml(value)}">${ui.escapeHtml(value)}</option>`).join("");
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  }
  function renderMetrics(metrics) {
    const rows = [
      ["Docentes", metrics.teachers], ["Capacitaciones propuestas", metrics.proposedTrainings], ["Capacitaciones ejecutadas", metrics.executedTrainings],
      ["Horas planificadas", metrics.plannedHours], ["Horas ejecutadas", metrics.executedHours], ["Participantes", metrics.participants],
      ["Acuerdos", `${metrics.agreementsFound}/${metrics.agreementsRequired}`], ["Cumplimiento documental", `${metrics.documentaryCompliance}%`],
      ["Cadenas completas", metrics.completeChains], ["Satisfacción promedio", metrics.averageSatisfaction ?? "Sin dato"],
      ["Impacto promedio", metrics.averageImpact ?? "Sin dato"], ["Registros para revisión", metrics.recordsForReview]
    ];
    els.metrics.innerHTML = rows.map(([label, value]) => `<article class="metric-card"><span>${ui.escapeHtml(label)}</span><strong>${ui.escapeHtml(value)}</strong></article>`).join("");
  }
  function renderBars(container, rows, options = {}) {
    const data = rows || [];
    if (!data.length) { container.innerHTML = '<div class="empty">Sin datos.</div>'; return; }
    const max = options.max || Math.max(...data.map((row) => Number(row.value || 0)), 1);
    container.innerHTML = `<div class="chart-bars">${data.map((row) => {
      const value = Number(row.value || 0); const width = Math.max(0, Math.min(100, (value / max) * 100));
      return `<div class="chart-row"><span>${ui.escapeHtml(row.label)}</span><div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div><span class="chart-value">${ui.escapeHtml(`${value}${options.suffix || ""}`)}</span></div>`;
    }).join("")}</div>`;
  }
  function renderSections(sections) {
    els.nav.innerHTML = sections.map((section) => `<button data-target="${ui.escapeHtml(section.id)}">${ui.escapeHtml(section.title)}</button>`).join("");
    els.sections.innerHTML = sections.map((section) => `<section class="report-section" id="section-${ui.escapeHtml(section.id)}"><h3>${ui.escapeHtml(section.title)}</h3><p>${ui.escapeHtml(section.text)}</p></section>`).join("");
    els.nav.querySelectorAll("[data-target]").forEach((button) => button.addEventListener("click", () => element(`section-${button.dataset.target}`)?.scrollIntoView({ behavior: "smooth" })));
  }
  function renderGaps(gaps) {
    const rows = (gaps || []).filter((gap) => gap.missing > 0);
    els.alerts.innerHTML = rows.length ? `<div class="gap-list">${rows.map((gap) => `<div class="gap-item"><span>${ui.escapeHtml(gap.label)} <small>(${ui.escapeHtml(gap.priority)})</small></span><strong>${ui.escapeHtml(gap.missing)}</strong></div>`).join("")}</div>` : '<div class="status-box status-success">No se detectaron brechas.</div>';
  }
  function renderState(report, providers) {
    const configured = (providers || []).filter((item) => item.configured).length;
    const states = [["Datos cargados", true], ["Métricas calculadas", Boolean(report.metrics)], ["Análisis interno", report.analysis?.generatedBy === "INTERNAL_ENGINE"], [`IA configurada ${configured}/3`, configured > 0], ["Formato institucional", false]];
    els.state.innerHTML = states.map(([label, active]) => `<span class="state-chip ${active ? "active" : "warning"}">${ui.escapeHtml(label)}</span>`).join("");
  }
  function renderDashboard(result) {
    const report = result.report;
    fillSelect("compliancePeriod", report.options.periods, "Todos"); fillSelect("complianceCareer", report.options.careers, "Todas"); fillSelect("complianceModality", report.options.modalities, "Todas");
    renderState(report, result.aiProviders); renderMetrics(report.metrics); renderBars(els.documentChart, report.charts.documentaryCoverage, { max: 100, suffix: "%" });
    renderBars(els.hoursChart, report.charts.hoursComparison); renderBars(els.careersChart, report.charts.trainingsByCareer.slice(0, 10)); renderBars(els.gapsChart, report.charts.principalGaps);
    renderSections(report.sections); renderGaps(report.gaps);
  }
  async function loadDashboard() {
    if (loading) return; setBusy(true); setStatus("Consolidando la base local...", "info");
    try {
      const result = await windowObject.documentAppAPI.getComplianceDashboard(filters()); renderDashboard(result);
      setStatus(result.validation?.warnings?.length ? "Informe global calculado con advertencias." : "Informe global calculado correctamente.", result.validation?.warnings?.length ? "warning" : "success");
    } catch (error) { setStatus(`No se pudo construir el informe: ${error.message}`, "danger"); } finally { setBusy(false); }
  }
  async function runInternal() {
    if (loading) return; setBusy(true); setStatus("Ejecutando el motor interno...", "info");
    try { const result = await windowObject.documentAppAPI.runComplianceInternalAnalysis(filters()); setStatus(`Motor interno completado: ${result.analysis?.findings?.length || 0} hallazgo(s).`, "success"); }
    catch (error) { setStatus(`Falló el motor interno: ${error.message}`, "danger"); } finally { setBusy(false); }
  }
  async function refineAi() {
    if (loading) return; setBusy(true); setStatus("Intentando la cadena de tres IAs...", "info");
    try { const result = await windowObject.documentAppAPI.refineComplianceWithAi(filters()); setStatus(result.ai?.message || "Proceso de IA terminado.", result.ai?.status === "AI_REFINED" ? "success" : "warning"); }
    catch (error) { setStatus(`No se pudo ejecutar la cadena de IA: ${error.message}`, "danger"); } finally { setBusy(false); }
  }
  async function prepare() {
    if (loading) return; setBusy(true); setStatus("Preparando el borrador estructurado...", "info");
    try {
      const result = await windowObject.documentAppAPI.prepareComplianceReport(filters());
      els.preview.innerHTML = `<div class="status-box ${result.validation?.warnings?.length ? "status-warning" : "status-success"}">${ui.escapeHtml(result.message)}</div><pre>${ui.escapeHtml(JSON.stringify(result.draft, null, 2))}</pre>`;
      setStatus(result.message, result.validation?.warnings?.length ? "warning" : "success");
    } catch (error) { setStatus(`No se pudo preparar el informe: ${error.message}`, "danger"); } finally { setBusy(false); }
  }
  function init() {
    els.apply.addEventListener("click", loadDashboard); els.refresh.addEventListener("click", loadDashboard); els.internal.addEventListener("click", runInternal); els.ai.addEventListener("click", refineAi); els.prepare.addEventListener("click", prepare);
    element("complianceQuery").addEventListener("keydown", (event) => { if (event.key === "Enter") loadDashboard(); }); loadDashboard();
  }
  if (documentObject.readyState === "loading") documentObject.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})(window, document);
