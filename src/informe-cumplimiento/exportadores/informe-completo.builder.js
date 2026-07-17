"use strict";

function selectSections(sections, sectionIds) {
  const ids = new Set(Array.isArray(sectionIds) ? sectionIds : []);
  if (!ids.size) return sections || [];
  return (sections || []).filter((section) => ids.has(section.sectionId || section.id));
}

function buildExportDocument(report, sections, options = {}) {
  const selected = selectSections(sections, options.sectionIds);
  return {
    title: report.title || "Informe de Cumplimiento de Capacitación y Formación",
    generatedAt: new Date().toISOString(),
    filters: report.filters || {},
    metrics: report.metrics || {},
    objectives: report.objectives || {},
    gaps: options.includeAlerts === false ? [] : (report.gaps || []),
    charts: options.includeCharts === false ? {} : (report.charts || {}),
    coverage: options.includeTrainingDetail === false ? [] : (report.coverage || []),
    sections: selected,
    options: {
      includeCharts: options.includeCharts !== false,
      includeTables: options.includeTables !== false,
      includeAnnexes: options.includeAnnexes !== false,
      includeCareerDetail: options.includeCareerDetail !== false,
      includeTrainingDetail: options.includeTrainingDetail !== false,
      includeAlerts: options.includeAlerts !== false
    }
  };
}

module.exports = { selectSections, buildExportDocument };
