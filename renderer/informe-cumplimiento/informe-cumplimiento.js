"use strict";

(function initializeCompliancePage(windowObject, documentObject) {
  const ui = windowObject.AppUI;
  const components = windowObject.ComplianceComponents || {};
  const element = (id) => documentObject.getElementById(id);
  const roles = ["PRIMARY", "SECONDARY", "BACKUP"];
  let loading = false;
  let dashboard = null;
  let guides = [];
  let selectedGuideId = "";
  let outputDir = "";

  const els = {
    status: element("complianceStatusBox"), state: element("complianceAnalysisState"), metrics: element("complianceMetrics"),
    sections: element("complianceSections"), alerts: element("complianceAlerts"), guideList: element("guideList"), guideTest: element("guideTestResult"),
    documentChart: element("chartDocumentaryCoverage"), hoursChart: element("chartHours"), careersChart: element("chartCareers"), gapsChart: element("chartGaps"),
    apply: element("btnApplyComplianceFilters"), refresh: element("btnRefreshCompliance"), internal: element("btnRunInternalAnalysis"), export: element("btnExportCompliance")
  };

  function filters() { return { period: element("compliancePeriod").value, career: element("complianceCareer").value, modality: element("complianceModality").value, query: element("complianceQuery").value }; }
  function setStatus(message, type = "info") { els.status.className = ui.statusClass(type); els.status.textContent = message; }
  function setBusy(value) { loading = Boolean(value); [els.apply, els.refresh, els.internal, els.export].filter(Boolean).forEach((button) => { button.disabled = loading; }); }
  function fillSelect(id, values, label) { const select = element(id); const current = select.value; select.innerHTML = `<option value="">${ui.escapeHtml(label)}</option>` + (values || []).map((value) => `<option value="${ui.escapeHtml(value)}">${ui.escapeHtml(value)}</option>`).join(""); if ([...select.options].some((option) => option.value === current)) select.value = current; }
  function renderMetrics(metrics) { const rows = [["Docentes",metrics.teachers],["Capacitaciones propuestas",metrics.proposedTrainings],["Capacitaciones ejecutadas",metrics.executedTrainings],["Horas planificadas",metrics.plannedHours],["Horas ejecutadas",metrics.executedHours],["Participantes",metrics.participants],["Acuerdos",`${metrics.agreementsFound}/${metrics.agreementsRequired}`],["Cumplimiento documental",`${metrics.documentaryCompliance}%`],["Cadenas completas",metrics.completeChains],["Satisfacción promedio",metrics.averageSatisfaction ?? "Sin dato"],["Impacto promedio",metrics.averageImpact ?? "Sin dato"],["Registros para revisión",metrics.recordsForReview]]; els.metrics.innerHTML = rows.map(([label,value]) => `<article class="metric-card"><span>${ui.escapeHtml(label)}</span><strong>${ui.escapeHtml(value)}</strong></article>`).join(""); }
  function renderBars(container, rows, options = {}) { const data = rows || []; if (!data.length) { container.innerHTML = '<div class="empty">Sin datos.</div>'; return; } const max = options.max || Math.max(...data.map((row) => Number(row.value || 0)), 1); container.innerHTML = `<div class="chart-bars">${data.map((row) => { const value = Number(row.value || 0); const width = Math.max(0, Math.min(100, (value / max) * 100)); return `<div class="chart-row"><span>${ui.escapeHtml(row.label)}</span><div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div><span class="chart-value">${ui.escapeHtml(`${value}${options.suffix || ""}`)}</span></div>`; }).join("")}</div>`; }
  function renderGaps(gaps) { const rows = (gaps || []).filter((gap) => gap.missing > 0); els.alerts.innerHTML = rows.length ? `<div class="gap-list">${rows.map((gap) => `<div class="gap-item"><span>${ui.escapeHtml(gap.label)} <small>(${ui.escapeHtml(gap.priority)})</small></span><strong>${ui.escapeHtml(gap.missing)}</strong></div>`).join("")}</div>` : '<div class="status-box status-success">No se detectaron brechas.</div>'; }
  function renderState(report, providers) { const configured = (providers || []).filter((item) => item.configured).length; const states = [["Base local",true],["Métricas",Boolean(report.metrics)],["Motor interno",report.analysis?.generatedBy === "INTERNAL_ENGINE"],[`IA ${configured}/3`,configured > 0],["Formato institucional",false]]; els.state.innerHTML = states.map(([label,active]) => `<span class="state-chip ${active ? "active" : "warning"}">${ui.escapeHtml(label)}</span>`).join(""); }

  function selectGuide(id) { selectedGuideId = id; const guide = guides.find((item) => item.id === id); components.renderGuideList(els.guideList, guides, selectedGuideId, selectGuide); components.fillGuideForm(guide); }
  function renderSections(statuses) { components.renderSectionCards(els.sections, statuses, { edit: selectGuide, test: (id) => testGuide(id), generate: (id) => generateSection(id), docx: (id) => exportSingle(id, "DOCX"), pdf: (id) => exportSingle(id, "PDF") }); element("sectionCountBadge").textContent = String((statuses || []).length); updateExportSummary(); }
  function renderDashboard(result) { dashboard = result; const report = result.report; guides = result.guides || []; if (!selectedGuideId || !guides.some((guide) => guide.id === selectedGuideId)) selectedGuideId = guides[0]?.id || ""; fillSelect("compliancePeriod", report.options.periods, "Todos"); fillSelect("complianceCareer", report.options.careers, "Todas"); fillSelect("complianceModality", report.options.modalities, "Todas"); renderState(report, result.aiProviders); renderMetrics(report.metrics); renderBars(els.documentChart, report.charts.documentaryCoverage, { max: 100, suffix: "%" }); renderBars(els.hoursChart, report.charts.hoursComparison); renderBars(els.careersChart, report.charts.trainingsByCareer.slice(0, 10)); renderBars(els.gapsChart, report.charts.principalGaps); renderGaps(report.gaps); components.renderGuideList(els.guideList, guides, selectedGuideId, selectGuide); components.fillGuideForm(guides.find((guide) => guide.id === selectedGuideId)); renderSections(result.sectionStatuses || []); }

  async function loadDashboard() { if (loading) return; setBusy(true); setStatus("Consolidando la base local...", "info"); try { const result = await windowObject.documentAppAPI.getComplianceDashboard(filters()); renderDashboard(result); setStatus(result.validation?.warnings?.length ? "Informe global calculado con advertencias." : "Informe global calculado correctamente.", result.validation?.warnings?.length ? "warning" : "success"); } catch (error) { setStatus(`No se pudo construir el informe: ${error.message}`, "danger"); } finally { setBusy(false); } }
  async function runInternal() { if (loading) return; setBusy(true); setStatus("Ejecutando el motor interno...", "info"); try { const result = await windowObject.documentAppAPI.runComplianceInternalAnalysis(filters()); setStatus(`Motor interno completado: ${result.analysis?.findings?.length || 0} hallazgo(s).`, "success"); await loadDashboard(); } catch (error) { setStatus(`Falló el motor interno: ${error.message}`, "danger"); } finally { setBusy(false); } }
  async function saveGuide() { const guide = components.readGuideForm(guides.find((item) => item.id === selectedGuideId)); const result = await windowObject.documentAppAPI.saveComplianceGuide(guide); guides = result.guides || guides; selectGuide(guide.id); setStatus("Guía guardada.", "success"); }
  async function restoreGuide() { const result = await windowObject.documentAppAPI.restoreComplianceGuide(selectedGuideId); guides = result.guides || guides; selectGuide(selectedGuideId); setStatus("Guía restaurada.", "success"); }
  async function testGuide(id = selectedGuideId) { const guide = guides.find((item) => item.id === id); if (!guide) return; selectGuide(id); const mode = element("guideTestMode").value; setStatus("Probando la guía seleccionada...", "info"); try { const result = await windowObject.documentAppAPI.testComplianceGuide({ guide: components.readGuideForm(guide), filters: filters(), mode }); components.renderGuideTest(els.guideTest, result); setStatus("Prueba de guía terminada.", result.ai?.status === "INTERNAL_FALLBACK" ? "warning" : "success"); } catch (error) { setStatus(`No se pudo probar la guía: ${error.message}`, "danger"); } }
  async function generateSection(id) { setStatus("Generando la sección...", "info"); try { await windowObject.documentAppAPI.generateComplianceSection({ sectionId: id, filters: filters(), useAi: element("guideUseAiGeneration").checked }); setStatus("Sección regenerada y guardada.", "success"); await loadDashboard(); } catch (error) { setStatus(`No se pudo generar la sección: ${error.message}`, "danger"); } }

  async function openAiModal() { const result = await windowObject.documentAppAPI.getComplianceAiConfiguration(); components.renderAiModal(element("aiProvidersContainer"), result.providers || []); components.openAiModal(); bindAiCardTests(); }
  function bindAiCardTests() { documentObject.querySelectorAll("[data-ai-test]").forEach((button) => button.addEventListener("click", async () => { const role = button.dataset.aiTest; const target = documentObject.querySelector(`[data-ai-result="${role}"]`); target.textContent = "Probando..."; try { const result = await windowObject.documentAppAPI.testComplianceAiProvider(role); target.textContent = result.ok ? "Conexión correcta" : (result.message || "Falló la prueba"); } catch (error) { target.textContent = error.message; } })); }
  async function saveAiConfiguration() { for (const role of roles) await windowObject.documentAppAPI.saveComplianceAiConfiguration(components.readAiProvider(role)); element("aiModalStatus").textContent = "Configuración guardada."; await loadDashboard(); }
  async function testAiChain() { element("aiModalStatus").textContent = "Probando cadena..."; try { const result = await windowObject.documentAppAPI.testComplianceAiChain(); element("aiModalStatus").textContent = result.status === "AI_REFINED" ? `Cadena correcta: ${result.provider}` : (result.message || "Se utilizó el motor interno."); } catch (error) { element("aiModalStatus").textContent = error.message; } }

  function updateExportSummary() { const count = components.selectedSectionIds().length; element("exportSelectionSummary").textContent = `${count} sección(es) seleccionada(s)`; }
  async function ensureOutputDirectory() { if (outputDir) return true; const result = await windowObject.documentAppAPI.chooseOutputDirectory(); if (result.canceled) return false; outputDir = result.outputDir; return true; }
  async function exportPayload(overrides = {}) { if (!(await ensureOutputDirectory())) return; const options = components.readExportOptions(); const result = await windowObject.documentAppAPI.exportComplianceReport({ ...options, ...overrides, outputDir, filters: filters() }); const files = Object.values(result.files || {}).filter(Boolean); setStatus(files.length ? `Documento generado: ${files.join(" | ")}` : "Exportación terminada.", "success"); }
  async function exportSingle(id, format) { selectGuide(id); await exportPayload({ scope: "SECTION", format, sectionIds: [id] }); }
  async function exportSelected() { try { await exportPayload(); } catch (error) { setStatus(`No se pudo exportar: ${error.message}`, "danger"); } }

  function bindEvents() {
    els.apply.addEventListener("click", loadDashboard); els.refresh.addEventListener("click", loadDashboard); els.internal.addEventListener("click", runInternal);
    element("complianceQuery").addEventListener("keydown", (event) => { if (event.key === "Enter") loadDashboard(); });
    element("btnToggleGuides").addEventListener("click", () => element("guidesPanel").classList.toggle("collapsed"));
    element("btnSaveGuide").addEventListener("click", () => saveGuide().catch((error) => setStatus(error.message, "danger")));
    element("btnTestGuide").addEventListener("click", () => testGuide()); element("btnRestoreGuide").addEventListener("click", () => restoreGuide().catch((error) => setStatus(error.message, "danger")));
    element("btnOpenAiConfiguration").addEventListener("click", () => openAiModal().catch((error) => setStatus(error.message, "danger")));
    element("btnCloseAiConfiguration").addEventListener("click", components.closeAiModal); element("btnCancelAiConfiguration").addEventListener("click", components.closeAiModal);
    element("btnSaveAiConfiguration").addEventListener("click", () => saveAiConfiguration().catch((error) => { element("aiModalStatus").textContent = error.message; })); element("btnTestAiChain").addEventListener("click", testAiChain);
    element("btnGoToExport").addEventListener("click", () => element("complianceExportCenter").scrollIntoView({ behavior: "smooth" })); element("btnExportCompliance").addEventListener("click", exportSelected);
    documentObject.addEventListener("change", (event) => { if (event.target.matches("[data-export-section]")) updateExportSummary(); });
  }

  function init() { bindEvents(); loadDashboard(); }
  if (documentObject.readyState === "loading") documentObject.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})(window, document);