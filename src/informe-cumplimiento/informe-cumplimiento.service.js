"use strict";

const { createComplianceReportQuery } = require("./informe-cumplimiento.query");
const { buildGlobalReport } = require("./informe-cumplimiento.engine");
const { createGuidesRepository } = require("./guias/guias.repository");
const { GuideVersionsService } = require("./guias/guia-versiones.service");
const { GuideTestService } = require("./guias/guia-test.service");
const { SectionRepository } = require("./secciones/seccion.repository");
const { SectionGeneratorService } = require("./secciones/seccion-generator.service");
const { AiConfigRepository } = require("./ia/ia-config.repository");
const { AiOrchestrator } = require("./ia/ia-orchestrator");
const { AiTestService } = require("./ia/ia-test.service");
const { ComplianceExportService } = require("./exportadores/export.service");

class ComplianceReportService {
  constructor(database, options = {}) {
    this.database = database;
    this.query = createComplianceReportQuery(database);
    this.guides = createGuidesRepository(database);
    this.guideVersions = new GuideVersionsService(this.guides);
    this.sections = new SectionRepository(database);
    this.sectionGenerator = new SectionGeneratorService(this.sections);
    this.aiConfig = new AiConfigRepository(database, options.secretStore || {});
    this.ai = options.aiOrchestrator || new AiOrchestrator({ configRepository: this.aiConfig, ...(options.ai || {}) });
    this.aiTest = new AiTestService(this.aiConfig);
    this.guideTest = new GuideTestService(this.sectionGenerator, this.ai);
    this.exporter = options.exportService || new ComplianceExportService();
  }

  build(filters = {}) { return buildGlobalReport(this.query.load(), filters); }
  getFilters() { return this.build({}).options; }

  getDashboard(filters = {}) {
    const report = this.build(filters);
    const guides = this.guides.list();
    const savedSections = this.sections.list(report.filters || filters);
    return {
      ok: true,
      report,
      validation: report.validation,
      guides,
      sectionStatuses: this.sectionGenerator.statuses(report, guides, savedSections),
      aiProviders: this.ai.getStatus()
    };
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

  listGuides() { return { ok: true, guides: this.guides.list() }; }
  saveGuide(guide) { return { ok: true, guide: this.guides.save(guide), guides: this.guides.list() }; }
  restoreGuide(guideId) { return { ok: true, guide: this.guides.restore(guideId), guides: this.guides.list() }; }
  listGuideVersions(guideId) { return { ok: true, versions: this.guideVersions.list(guideId) }; }

  async testGuide(payload = {}) {
    const report = this.build(payload.filters || {});
    const guide = payload.guide?.id ? payload.guide : this.guides.get(payload.guideId);
    if (!guide) throw new Error("No se encontró la guía solicitada.");
    return this.guideTest.test(report, guide, { mode: payload.mode || "INTERNAL" });
  }

  async generateSection(payload = {}) {
    const report = this.build(payload.filters || {});
    const guide = this.guides.get(payload.sectionId);
    if (!guide) throw new Error("No se encontró la sección solicitada.");
    let section = this.sectionGenerator.generate(report, guide, { persist: false });
    if (payload.useAi === true) {
      const ai = await this.ai.refineSection({ report, guide, section });
      if (ai.status === "AI_REFINED") {
        section = {
          ...section,
          content: ai.content,
          ai,
          generatedBy: ai.provider,
          status: { ...section.status, ai: "REFINADO", validation: ai.validation?.ok ? "CORRECTA" : "REVISAR" }
        };
      } else {
        section = { ...section, ai, status: { ...section.status, ai: "RESPALDO_INTERNO" } };
      }
    }
    const saved = this.sections.save(section, report.filters || payload.filters || {});
    return { ok: true, section: saved };
  }

  listAiConfiguration() { return { ok: true, providers: this.aiConfig.listPublic() }; }
  saveAiConfiguration(config) { return { ok: true, provider: this.aiConfig.save(config), providers: this.aiConfig.listPublic() }; }
  testAiProvider(role) { return this.aiTest.testProvider(role); }
  testAiChain() { return this.ai.testChain(); }

  prepareReport(filters = {}) {
    const report = this.build(filters);
    const guides = this.guides.list();
    const sections = this.sectionGenerator.generateAll(report, guides, { persist: false });
    return {
      ok: true,
      message: report.validation.warnings.length
        ? "Informe preparado con advertencias y pendiente del formato institucional."
        : "Informe preparado y pendiente del formato institucional.",
      validation: report.validation,
      sectionCount: sections.length,
      report
    };
  }

  async exportReport(payload = {}) {
    const report = this.build(payload.filters || {});
    const guides = this.guides.list();
    const saved = new Map(this.sections.list(report.filters || payload.filters || {}).map((section) => [section.sectionId, section]));
    const sections = guides.filter((guide) => guide.enabled !== false).map((guide) => saved.get(guide.id) || this.sectionGenerator.generate(report, guide, { persist: false }));
    return this.exporter.export(report, sections, payload);
  }
}

function createComplianceReportService(database, options = {}) { return new ComplianceReportService(database, options); }
module.exports = { ComplianceReportService, createComplianceReportService };
