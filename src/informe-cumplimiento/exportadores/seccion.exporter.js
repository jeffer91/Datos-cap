"use strict";

const { buildExportDocument } = require("./informe-completo.builder");
const { exportWord } = require("./word.exporter");
const { exportPdf } = require("./pdf.exporter");

async function exportSection(report, section, options) {
  const documentData = buildExportDocument(report, [section], { ...options, sectionIds: [section.sectionId || section.id] });
  const base = `${section.title}_${report.filters?.period || "global"}`;
  const files = {};
  if (["DOCX", "BOTH"].includes(options.format)) files.docx = await exportWord(documentData, options.outputDir, base);
  if (["PDF", "BOTH"].includes(options.format)) files.pdf = await exportPdf(documentData, options.outputDir, base);
  return files;
}

module.exports = { exportSection };
