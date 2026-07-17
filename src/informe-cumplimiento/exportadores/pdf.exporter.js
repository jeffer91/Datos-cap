"use strict";

const fs = require("fs");
const path = require("path");
const { sanitize } = require("./word.exporter");

function writeHeading(doc, value, size = 16) {
  doc.moveDown(0.4).font("Helvetica-Bold").fontSize(size).fillColor("#173f6d").text(String(value || ""), { align: "left" });
  doc.font("Helvetica").fontSize(10).fillColor("#172033");
}

function writeMetrics(doc, metrics) {
  const entries = [
    ["Docentes", metrics.teachers], ["Capacitaciones propuestas", metrics.proposedTrainings],
    ["Capacitaciones ejecutadas", metrics.executedTrainings], ["Horas planificadas", metrics.plannedHours],
    ["Horas ejecutadas", metrics.executedHours], ["Participantes", metrics.participants],
    ["Cumplimiento documental", `${metrics.documentaryCompliance || 0}%`], ["Cadenas completas", metrics.completeChains]
  ];
  entries.forEach(([label, value]) => doc.font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(String(value ?? "Sin dato")));
}

async function exportPdf(documentData, outputDir, fileBase) {
  let PDFDocument;
  try { PDFDocument = require("pdfkit"); }
  catch (_error) { throw new Error("Falta instalar la dependencia pdfkit. Ejecuta npm install antes de exportar PDF."); }
  fs.mkdirSync(outputDir, { recursive: true });
  const target = path.join(outputDir, `${sanitize(fileBase)}.pdf`);
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 52, info: { Title: documentData.title } });
    const stream = fs.createWriteStream(target);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
    doc.font("Helvetica-Bold").fontSize(21).fillColor("#0f2f52").text(documentData.title, { align: "center" });
    doc.moveDown().font("Helvetica").fontSize(9).fillColor("#475569").text(`Generado: ${new Date(documentData.generatedAt).toLocaleString("es-EC")}`, { align: "center" });
    writeHeading(doc, "Métricas generales", 15);
    writeMetrics(doc, documentData.metrics);
    documentData.sections.forEach((section) => {
      doc.addPage();
      writeHeading(doc, section.title, 16);
      doc.moveDown(0.4).font("Helvetica").fontSize(10.5).fillColor("#172033").text(String(section.content || ""), { align: "justify", lineGap: 3 });
      if (documentData.options.includeTables && (section.evidence || []).length) {
        writeHeading(doc, "Evidencias", 12);
        section.evidence.slice(0, 25).forEach((item) => doc.fontSize(9).text(`• ${item.source}: ${typeof item.value === "object" ? JSON.stringify(item.value) : item.value}`, { indent: 8 }));
      }
    });
    const gaps = documentData.gaps.filter((gap) => gap.missing > 0);
    if (gaps.length) {
      doc.addPage();
      writeHeading(doc, "Brechas y alertas", 16);
      gaps.forEach((gap) => doc.fontSize(10).text(`• ${gap.label}: ${gap.missing} de ${gap.total} (${gap.percentage}%). Prioridad ${gap.priority}.`, { indent: 8, lineGap: 2 }));
    }
    doc.end();
  });
  return target;
}

module.exports = { exportPdf };
