"use strict";

const fs = require("fs");
const path = require("path");

function sanitize(value) {
  return String(value || "informe").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 110);
}

function metricRows(docx, metrics) {
  const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType } = docx;
  const labels = {
    teachers: "Docentes",
    proposedTrainings: "Capacitaciones propuestas",
    executedTrainings: "Capacitaciones ejecutadas",
    plannedHours: "Horas planificadas",
    executedHours: "Horas ejecutadas",
    participants: "Participantes",
    documentaryCompliance: "Cumplimiento documental (%)",
    completeChains: "Cadenas completas",
    averageSatisfaction: "Satisfacción promedio",
    averageImpact: "Impacto promedio"
  };
  const rows = Object.entries(labels).map(([key, label]) => new TableRow({ children: [
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })] }),
    new TableCell({ children: [new Paragraph({ text: String(metrics[key] ?? "Sin dato") })] })
  ] }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

async function exportWord(documentData, outputDir, fileBase) {
  let docx;
  try { docx = require("docx"); }
  catch (_error) { throw new Error("Falta instalar la dependencia docx. Ejecuta npm install antes de exportar Word."); }
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = docx;
  fs.mkdirSync(outputDir, { recursive: true });
  const children = [
    new Paragraph({ text: documentData.title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Generado: ${new Date(documentData.generatedAt).toLocaleString("es-EC")}`, italics: true })] }),
    new Paragraph({ text: "Métricas generales", heading: HeadingLevel.HEADING_1 }),
    metricRows(docx, documentData.metrics)
  ];
  documentData.sections.forEach((section, index) => {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: index > 0 }));
    String(section.content || "").split(/\n{2,}/).filter(Boolean).forEach((block) => children.push(new Paragraph({ text: block, spacing: { after: 160 } })));
    const evidence = section.evidence || [];
    if (documentData.options.includeTables && evidence.length) {
      children.push(new Paragraph({ text: "Evidencias", heading: HeadingLevel.HEADING_2 }));
      evidence.slice(0, 30).forEach((item) => children.push(new Paragraph({ text: `${item.source}: ${typeof item.value === "object" ? JSON.stringify(item.value) : item.value}`, bullet: { level: 0 } })));
    }
  });
  if (documentData.gaps.length) {
    children.push(new Paragraph({ text: "Brechas y alertas", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    documentData.gaps.filter((gap) => gap.missing > 0).forEach((gap) => children.push(new Paragraph({ text: `${gap.label}: ${gap.missing} de ${gap.total} (${gap.percentage}%). Prioridad ${gap.priority}.`, bullet: { level: 0 } })));
  }
  const document = new Document({ sections: [{ properties: {}, children }] });
  const target = path.join(outputDir, `${sanitize(fileBase)}.docx`);
  fs.writeFileSync(target, await Packer.toBuffer(document));
  return target;
}

module.exports = { sanitize, exportWord };
