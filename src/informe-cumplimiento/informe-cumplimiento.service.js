"use strict";

const { createComplianceReportQuery } = require("./informe-cumplimiento.query");
const { buildGlobalReport } = require("./informe-cumplimiento.engine");
const { AiOrchestrator } = require("./ia/ia-orchestrator");

class ComplianceReportService {
  constructor(database, options = {}) {
    this.query = createComplianceReportQuery(database);
    this.ai = options.aiOrchestrator || new AiOrchestrator(options.ai || {});
  }
  build(filters = {}) { return buildGlobalReport(this.query.load(), filters); }
  getFilters() { return this.build({}).options; }
  getDashboard(filters = {}) {
    const report = this.build(filters);
    return { ok: true, report, validation: report.validation, aiProviders: this.ai.getStatus() };
  }
  runInternalAnalysis(filters = {}) {
    const report = this.build(filters);
    return { ok: true, analysis: report.analysis, metrics: report.metrics, gaps: report.gaps };
  }
  async refineWithAi(filters = {}) {
    const report = this.build(filters);
    report.ai = await this.ai.refine(report);
    return { ok: true, report, ai: report.ai };
  }
  prepareReport(filters = {}) {
    const report = this.build(filters);
    const draft = {
      formatVersion: "0.1-draft", title: report.title, generatedAt: new Date().toISOString(), filters: report.filters,
      metrics: report.metrics, objectives: report.objectives, charts: report.charts, gaps: report.gaps,
      analysis: report.analysis, sections: report.sections, ai: report.ai,
      note: "Borrador pendiente de adaptar al informe institucional que proporcionará el usuario."
    };
    return {
      ok: true,
      message: report.validation.warnings.length ? "Informe preparado con advertencias y pendiente del formato institucional." : "Informe preparado y pendiente del formato institucional.",
      validation: report.validation, draft, report
    };
  }
}

function createComplianceReportService(database, options = {}) { return new ComplianceReportService(database, options); }
module.exports = { ComplianceReportService, createComplianceReportService };
