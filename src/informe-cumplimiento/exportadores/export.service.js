"use strict";

const path = require("path");
const { exportSection } = require("./seccion.exporter");
const { exportFullReport } = require("./informe-completo.exporter");

class ComplianceExportService {
  async export(report, sections, input = {}) {
    const format = String(input.format || "BOTH").toUpperCase();
    if (!new Set(["PDF", "DOCX", "BOTH"]).has(format)) throw new Error("Formato de exportación no permitido.");
    const outputDir = path.resolve(String(input.outputDir || "").trim());
    if (!input.outputDir) throw new Error("Selecciona una carpeta de salida.");
    const options = {
      ...input,
      format,
      outputDir,
      includeCharts: input.includeCharts !== false,
      includeTables: input.includeTables !== false,
      includeAnnexes: input.includeAnnexes !== false,
      includeCareerDetail: input.includeCareerDetail !== false,
      includeTrainingDetail: input.includeTrainingDetail !== false,
      includeAlerts: input.includeAlerts !== false
    };
    const selectedIds = Array.isArray(input.sectionIds) ? input.sectionIds : [];
    const selected = selectedIds.length ? sections.filter((section) => selectedIds.includes(section.sectionId || section.id)) : sections;
    if (!selected.length) throw new Error("Selecciona al menos una sección para exportar.");
    const files = input.scope === "SECTION" && selected.length === 1
      ? await exportSection(report, selected[0], options)
      : await exportFullReport(report, selected, options);
    return { ok: true, files, sectionCount: selected.length, format };
  }
}

module.exports = { ComplianceExportService };
