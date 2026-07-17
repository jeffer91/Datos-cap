"use strict";

(function initializeCompliancePage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  const components = windowObject.ComplianceComponents;
  let loading = false;
  let report = null;
  let guides = [];
  let sectionStatuses = [];
  let aiProviders = [];
  let selectedGuideId = "general";
  const element = (id) => documentObject.getElementById(id);
  const els = {
    status: element("complianceStatusBox"), state: element("complianceAnalysisState"), metrics: element("complianceMetrics"),
    sections: element("complianceSections"), alerts: element("complianceAlerts"), guideList: element("guideList"), guideTest: element("guideTestResult"),
    documentChart: element("chartDocumentaryCoverage"), hoursChart: element("chartHours"), careersChart: element("chartCareers"), gapsChart: element("chartGaps"),
    apply: element("btnApplyComplianceFilters"), refresh: element("btnRefreshCompliance"), internal: element("btnRunInternalAnalysis"),
    openAi: element("btnOpenAiConfiguration"), goExport: element("btnGoToExport"), export: element("btnExportCompliance"),
    saveGuide: element("btnSaveGuide"), testGuide: element("btnTestGuide"), restoreGuide: element("btnRestoreGuide")
  };

  function filters() { return { period: element("compliancePeriod").value, career: element("complianceCareer").value, modality: element("complianceModality").value, query: element("complianceQuery").value }; }
  function setStatus(message, type = "info") { els.status.className = ui.statusClass(type); els.status.textContent = message; }
  function setBusy(value) {
    loading = Boolean(value);
    [els.apply, els.refresh, els.internal, els.openAi, els.export, els.saveGuide, els.testGuide, els.restoreGuide].forEach((button) => { if (button) button.disabled = loading; });
  }
  function currentGuide() { return guides.find((guide) => guide.id === selectedGuideId) || guides[0] || null; }

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

  function renderGaps(gaps) {
    const rows = (gaps || []).filter((gap) => gap.missing > 0);
    els.alerts.innerHTML = rows.length ? `<div class="gap-list">${rows.map((gap) => `<div class="gap-item"><span>${ui.escapeHtml(gap.label)} <small>(${ui.escapeHtml(gap.priority)})</small></span><strong>${ui.escapeHtml(gap.missing)}</strong></div>`).join("")}</div>` : '<div class="status-box status-success">No se detectaron brechas.</div>';
  }

  function renderState() {
    const configured = aiProviders.filter((item) => item.configured).length;
    const states = [["Base local conectada", true], ["Métricas calculadas", Boolean(report?.metrics)], ["Motor interno listo", report?.analysis?.generatedBy === "INTERNAL_ENGINE"], [`IA configurada ${configured}/3`, configured > 0], ["Formato institucional pendiente", false]];
    els.state.innerHTML = states.map(([label, active]) => `<span class="state-chip ${active ? "active" : "warning"}">${ui.escapeHtml(label)}</span>`).join("");
  }

  function selectGuide(id, focus = false) {
    selectedGuideId = id;
    components.renderGuideList(els.guideList, guides, selectedGuideId, (guideId) => selectGuide(guideId, false));
    const guide = currentGuide();
    components.fillGuideForm(guide);
    element("guideEditorHeading").textContent = guide?.title || "Configuración de guía";
    components.renderGuideTest(els.guideTest, null);
    if (focus) element("guidesPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateExportSummary() {
    element("exportSelectionSummary").textContent = `${components.selectedSectionIds().length} sección(es) seleccionada(s)`;
  }

  function renderSections() {
    components.renderSectionCards(els.sections, sectionStatuses, {
      edit: (id) => selectGuide(id, true),
      test: (id) => { selectGuide(id, true); testGuide(); },
      generate: (id) => generateSection(id),
      docx: (id) => exportSection(id, "DOCX"),
      pdf: (id) => exportSection(id, "PDF")
    });
    element("sectionCountBadge").textContent = String(sectionStatuses.length);
    documentObject.querySelectorAll("[data-export-section]").forEach((input) => input.addEventListener("change", updateExportSummary));
    updateExportSummary();
  }

  function renderDashboard(result) {
    report = result.report;
    guides = result.guides || [];
    sectionStatuses = result.sectionStatuses || [];
    aiProviders = result.aiProviders || [];
    fillSelect("compliancePeriod", report.options.periods, "Todos"); fillSelect("complianceCareer", report.options.careers, "Todas"); fillSelect("complianceModality", report.options.modalities, "Todas");
    renderState(); renderMetrics(report.metrics); renderBars(els.documentChart, report.charts.documentaryCoverage, { max: 100, suffix: "%" });
    renderBars(els.hoursChart, report.charts.hoursComparison); renderBars(els.careersChart, report.charts.trainingsByCareer.slice(0, 10)); renderBars(els.gapsChart, report.charts.principalGaps);
    renderGaps(report.gaps); renderSections();
    if (!guides.some((guide) => guide.id === selectedGuideId)) selectedGuideId = guides[0]?.id || "";
    selectGuide(selectedGuideId);
    components.renderAiModal(element("aiProvidersContainer"), aiProviders);
    bindAiTestButtons();
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

  async function saveGuide() {
    const guide = components.readGuideForm(currentGuide());
    setBusy(true); setStatus("Guardando la guía...", "info");
    try { const result = await windowObject.documentAppAPI.saveComplianceGuide(guide); guides = result.guides; selectGuide(guide.id); setStatus("Guía guardada en la base local.", "success"); }
    catch (error) { setStatus(`No se pudo guardar la guía: ${error.message}`, "danger"); } finally { setBusy(false); }
  }

  async function restoreGuide() {
    const guide = currentGuide(); if (!guide) return;
    setBusy(true); setStatus("Restaurando la guía predeterminada...", "info");
    try { const result = await windowObject.documentAppAPI.restoreComplianceGuide(guide.id); guides = result.guides; selectGuide(guide.id); setStatus("Guía restaurada.", "success"); }
    catch (error) { setStatus(`No se pudo restaurar: ${error.message}`, "danger"); } finally { setBusy(false); }
  }

  async function testGuide() {
    const guide = components.readGuideForm(currentGuide()); if (!guide?.id) return;
    setBusy(true); setStatus("Probando la guía sin modificar el informe definitivo...", "info");
    try { const result = await windowObject.documentAppAPI.testComplianceGuide({ guide, filters: filters(), mode: element("guideTestMode").value }); components.renderGuideTest(els.guideTest, result); setStatus(`Prueba completada con modo ${result.mode}.`, result.mode === "AI" ? "success" : "warning"); }
    catch (error) { components.renderGuideTest(els.guideTest, { section: { title: guide.title, content: error.message }, mode: "ERROR" }); setStatus(`La prueba falló: ${error.message}`, "danger"); } finally { setBusy(false); }
  }

  async function generateSection(id) {
    setBusy(true); setStatus("Regenerando la sección seleccionada...", "info");
    try {
      const result = await windowObject.documentAppAPI.generateComplianceSection({ sectionId: id, filters: filters(), useAi: element("guideUseAiGeneration").checked });
      setStatus(`Sección ${result.section.title} generada y guardada.`, result.section.status?.validation === "CORRECTA" ? "success" : "warning");
      setBusy(false);
      await loadDashboard();
      return;
    } catch (error) { setStatus(`No se pudo generar la sección: ${error.message}`, "danger"); } finally { setBusy(false); }
  }

  async function chooseOutput() {
    const selection = await windowObject.documentAppAPI.chooseOutputDirectory();
    return selection?.canceled ? "" : selection.outputDir;
  }

  async function exportPayload(payload) {
    const outputDir = await chooseOutput();
    if (!outputDir) return;
    setBusy(true); setStatus("Generando archivos Word/PDF...", "info");
    try {
      const result = await windowObject.documentAppAPI.exportComplianceReport({ ...payload, filters: filters(), outputDir });
      const files = Object.values(result.files || {}).join(" · ");
      setStatus(`Exportación completada. ${files}`, "success");
    } catch (error) { setStatus(`No se pudo exportar: ${error.message}`, "danger"); } finally { setBusy(false); }
  }

  function exportSection(id, format) { return exportPayload({ ...components.readExportOptions(), scope: "SECTION", format, sectionIds: [id] }); }
  function exportSelected() {
    const options = components.readExportOptions();
    if (options.scope === "FULL") options.sectionIds = [];
    if (options.scope !== "FULL" && !options.sectionIds.length) { setStatus("Selecciona al menos una sección.", "warning"); return; }
    return exportPayload(options);
  }

  function setAiModalStatus(message, type = "info") {
    const box = element("aiModalStatus"); box.textContent = message; box.className = `modal-status status-${type}`;
  }

  function bindAiTestButtons() {
    element("aiProvidersContainer").querySelectorAll("[data-ai-test]").forEach((button) => button.addEventListener("click", async () => {
      const role = button.dataset.aiTest;
      const resultBox = documentObject.querySelector(`[data-ai-result="${role}"]`);
      resultBox.textContent = "Probando...";
      try {
        await windowObject.documentAppAPI.saveComplianceAiConfiguration(components.readAiProvider(role));
        const result = await windowObject.documentAppAPI.testComplianceAiProvider(role);
        resultBox.textContent = result.ok ? `Conexión correcta · ${result.latencyMs} ms` : "La respuesta no fue válida";
      }
      catch (error) { resultBox.textContent = `Error: ${error.message}`; }
    }));
  }

  async function openAiModal() {
    try {
      const result = await windowObject.documentAppAPI.getComplianceAiConfiguration();
      aiProviders = result.providers || [];
      components.renderAiModal(element("aiProvidersContainer"), aiProviders); bindAiTestButtons(); components.openAiModal();
    } catch (error) { setStatus(`No se pudo abrir la configuración de IA: ${error.message}`, "danger"); }
  }

  async function saveAiConfiguration() {
    setAiModalStatus("Guardando configuración...", "info");
    try {
      for (const role of ["PRIMARY", "SECONDARY", "BACKUP"]) await windowObject.documentAppAPI.saveComplianceAiConfiguration(components.readAiProvider(role));
      const result = await windowObject.documentAppAPI.getComplianceAiConfiguration(); aiProviders = result.providers || [];
      components.renderAiModal(element("aiProvidersContainer"), aiProviders); bindAiTestButtons(); renderState(); setAiModalStatus("Configuración guardada. Las credenciales no se devuelven a la pantalla.", "success");
    } catch (error) { setAiModalStatus(`No se pudo guardar: ${error.message}`, "danger"); }
  }

  async function testAiChain() {
    setAiModalStatus("Probando principal, secundaria y respaldo...", "info");
    try { const result = await windowObject.documentAppAPI.testComplianceAiChain(); setAiModalStatus(result.ok ? `Cadena operativa. ${result.attempts.filter((item) => item.ok).length} proveedor(es) respondieron.` : "Ninguna IA respondió; el motor interno permanece disponible.", result.ok ? "success" : "warning"); }
    catch (error) { setAiModalStatus(`La prueba de cadena falló: ${error.message}`, "danger"); }
  }

  function bindEvents() {
    els.apply.addEventListener("click", loadDashboard); els.refresh.addEventListener("click", loadDashboard); els.internal.addEventListener("click", runInternal);
    els.saveGuide.addEventListener("click", saveGuide); els.testGuide.addEventListener("click", testGuide); els.restoreGuide.addEventListener("click", restoreGuide);
    els.openAi.addEventListener("click", openAiModal); els.goExport.addEventListener("click", () => element("complianceExportCenter").scrollIntoView({ behavior: "smooth" })); els.export.addEventListener("click", exportSelected);
    element("btnToggleGuides").addEventListener("click", () => element("guidesPanel").classList.toggle("collapsed"));
    element("btnCloseAiConfiguration").addEventListener("click", components.closeAiModal); element("btnCancelAiConfiguration").addEventListener("click", components.closeAiModal);
    element("btnSaveAiConfiguration").addEventListener("click", saveAiConfiguration); element("btnTestAiChain").addEventListener("click", testAiChain);
    element("complianceQuery").addEventListener("keydown", (event) => { if (event.key === "Enter") loadDashboard(); });
    documentObject.querySelectorAll('input[name="exportScope"], input[name="exportFormat"]').forEach((input) => input.addEventListener("change", updateExportSummary));
  }

  function init() { bindEvents(); loadDashboard(); }
  if (documentObject.readyState === "loading") documentObject.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})(window, document);
