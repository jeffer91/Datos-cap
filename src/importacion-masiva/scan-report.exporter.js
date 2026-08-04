/* =========================================================
Nombre completo: scan-report.exporter.js
Ruta o ubicación: /src/importacion-masiva/scan-report.exporter.js
Función o funciones:
- Construir un informe institucional del scan de Procesos Misionales.
- Resumir tipos, estados, procesos, periodos e incidencias detectadas.
- Exportar en PDF el inventario completo sin procesar nuevamente los documentos.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const { ensureDirectory, sanitizeFileName, pathApiFor, toDisplayPath } = require("../utils/file.utils");

const TYPE_LABELS = Object.freeze({
  "plan-individual": "Plan Individual",
  "acuerdo-patrocinio": "Acuerdo de Patrocinio",
  "planificacion-capacitacion": "Planificación de Capacitación",
  "informe-final-capacitacion": "Informe Final de Capacitación",
  "instrumento-evaluacion": "Instrumento de Evaluación",
  "informe-impacto": "Informe de Impacto",
  desconocido: "No identificado"
});

const STATUS_LABELS = Object.freeze({
  READY: "Listo",
  REVIEW: "Requiere revisión",
  UNSUPPORTED: "No identificado",
  EMPTY: "Archivo vacío",
  INACCESSIBLE: "Inaccesible",
  PROCESSED: "Procesado",
  PROCESSING_ERROR: "Error de procesamiento"
});

const COLORS = Object.freeze({
  navy: "#0f2f52",
  navy2: "#173f6d",
  text: "#172033",
  muted: "#64748b",
  line: "#d8e1ec",
  soft: "#f8fafc",
  softBlue: "#eff6ff",
  warning: "#92400e",
  danger: "#a61b1b",
  success: "#166534",
  white: "#ffffff"
});

function text(value) { return String(value == null ? "" : value).trim(); }
function list(value) { return Array.isArray(value) ? value : []; }
function number(value) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

function formatDate(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatBytes(bytes) {
  const value = number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function countBy(rows, keySelector) {
  return list(rows).reduce((counts, row) => {
    const key = text(keySelector(row)) || "Sin dato";
    counts[key] = number(counts[key]) + 1;
    return counts;
  }, {});
}

function sortedEntries(counts, labels = {}) {
  return Object.entries(counts || {})
    .map(([key, value]) => ({ key, label: labels[key] || key, value: number(value) }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es"));
}

function rootFolderName(rootPath) {
  const clean = toDisplayPath(rootPath);
  if (!clean) return "Procesos_Misionales";
  return pathApiFor(clean).basename(clean) || "Procesos_Misionales";
}

function buildScanReportData(snapshot = {}) {
  const batch = snapshot.batch || {};
  const files = list(snapshot.files).slice().sort((left, right) => text(left.relativePath || left.path).localeCompare(text(right.relativePath || right.path), "es", { sensitivity: "base" }));
  const summary = snapshot.summary || {};
  const processCodes = [...new Set(files.flatMap((file) => list(file.processCodes).length ? file.processCodes : [file.processCode]).map(text).filter(Boolean))].sort();
  const academicPeriods = [...new Set(files.map((file) => text(file.academicPeriod)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const typeCounts = countBy(files, (file) => file.detectedType || "desconocido");
  const statusCounts = countBy(files, (file) => file.status || "Sin estado");
  const issues = files.filter((file) => !["READY", "PROCESSED"].includes(file.status));

  return {
    title: "Informe de SCAN de Procesos Misionales",
    generatedAt: new Date().toISOString(),
    batch,
    files,
    issues,
    processCodes,
    academicPeriods,
    typeCounts,
    statusCounts,
    summary: {
      total: number(summary.total || files.length),
      ready: number(summary.ready || statusCounts.READY),
      review: number(summary.review || statusCounts.REVIEW),
      unsupported: number(summary.unsupported || statusCounts.UNSUPPORTED),
      empty: number(summary.empty || statusCounts.EMPTY),
      inaccessible: number(summary.inaccessible || statusCounts.INACCESSIBLE),
      processed: number(summary.processed || statusCounts.PROCESSED),
      failed: number(summary.failed || statusCounts.PROCESSING_ERROR),
      digital: number(summary.digital || files.filter((file) => file.extractionMethod === "digital").length),
      ocr: number(summary.ocr || files.filter((file) => ["ocr", "mixed"].includes(file.extractionMethod)).length)
    }
  };
}

function ensureSpace(doc, needed, onNewPage) {
  const bottom = doc.page.height - doc.page.margins.bottom - 22;
  if (doc.y + needed <= bottom) return;
  doc.addPage();
  if (typeof onNewPage === "function") onNewPage();
}

function writeSectionTitle(doc, value, size = 14) {
  ensureSpace(doc, 30);
  doc.moveDown(0.45).font("Helvetica-Bold").fontSize(size).fillColor(COLORS.navy2).text(text(value));
  doc.moveDown(0.25);
}

function writeMetadata(doc, data) {
  const rows = [
    ["Carpeta escaneada", text(data.batch.rootPath) || "Sin carpeta"],
    ["Fecha del scan", formatDate(data.batch.scannedAt || data.batch.startedAt)],
    ["Identificador", text(data.batch.id) || "Sin identificador"],
    ["PDF inventariados", String(data.summary.total)],
    ["Escaneo truncado", data.batch.truncated ? "Sí" : "No"]
  ];
  const labelWidth = 120;
  const valueWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - labelWidth;
  rows.forEach(([label, value]) => {
    ensureSpace(doc, 22);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.navy).text(`${label}:`, doc.page.margins.left, y, { width: labelWidth });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(value, doc.page.margins.left + labelWidth, y, { width: valueWidth });
    doc.y = Math.max(doc.y, y + 17);
  });
}

function writeSummaryGrid(doc, data) {
  const metrics = [
    ["PDF encontrados", data.summary.total],
    ["Listos", data.summary.ready],
    ["Para revisar", data.summary.review],
    ["No identificados", data.summary.unsupported],
    ["Vacíos", data.summary.empty],
    ["Inaccesibles", data.summary.inaccessible],
    ["Lectura digital", data.summary.digital],
    ["Con OCR", data.summary.ocr]
  ];
  const gap = 8;
  const columns = 4;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const boxWidth = (contentWidth - gap * (columns - 1)) / columns;
  const boxHeight = 47;
  ensureSpace(doc, boxHeight * 2 + gap + 8);
  const startX = doc.page.margins.left;
  const startY = doc.y;

  metrics.forEach(([label, value], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + column * (boxWidth + gap);
    const y = startY + row * (boxHeight + gap);
    doc.roundedRect(x, y, boxWidth, boxHeight, 6).fillAndStroke(COLORS.soft, COLORS.line);
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(label, x + 9, y + 8, { width: boxWidth - 18 });
    doc.font("Helvetica-Bold").fontSize(17).fillColor(COLORS.navy).text(String(value), x + 9, y + 22, { width: boxWidth - 18 });
  });
  doc.y = startY + boxHeight * 2 + gap + 4;
}

function writeCountColumns(doc, title, entries) {
  writeSectionTitle(doc, title, 12);
  if (!entries.length) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text("No se detectaron datos para este apartado.");
    return;
  }
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 18;
  const columnWidth = (contentWidth - gap) / 2;
  entries.forEach((entry, index) => {
    const column = index % 2;
    if (column === 0) ensureSpace(doc, 18);
    const y = column === 0 ? doc.y : doc.y - 18;
    const x = doc.page.margins.left + column * (columnWidth + gap);
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(entry.label, x, y, { width: columnWidth - 50, ellipsis: true });
    doc.font("Helvetica-Bold").fillColor(COLORS.navy).text(String(entry.value), x + columnWidth - 46, y, { width: 46, align: "right" });
    if (column === 0) doc.y = y + 18;
  });
  if (entries.length % 2 === 0) doc.y += 2;
}

function writeChips(doc, title, values) {
  writeSectionTitle(doc, title, 12);
  if (!values.length) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text("No se detectaron elementos.");
    return;
  }
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.text).text(values.join(" · "), { lineGap: 3 });
}

function drawInventoryHeader(doc, columns) {
  const x = doc.page.margins.left;
  const y = doc.y;
  const height = 25;
  let cursor = x;
  columns.forEach((column) => {
    doc.rect(cursor, y, column.width, height).fillAndStroke(COLORS.navy, COLORS.navy);
    doc.font("Helvetica-Bold").fontSize(7).fillColor(COLORS.white).text(column.label, cursor + 4, y + 8, { width: column.width - 8, align: column.align || "left", ellipsis: true });
    cursor += column.width;
  });
  doc.y = y + height;
}

function writeInventoryTable(doc, data) {
  writeSectionTitle(doc, "Inventario completo del SCAN", 15);
  if (!data.files.length) {
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.muted).text("La carpeta no contiene PDF inventariados.");
    return;
  }
  const columns = [
    { key: "number", label: "#", width: 26, align: "center" },
    { key: "file", label: "Archivo y ruta relativa", width: 245 },
    { key: "process", label: "Proceso", width: 55, align: "center" },
    { key: "period", label: "Periodo académico", width: 95 },
    { key: "type", label: "Tipo detectado", width: 125 },
    { key: "confidence", label: "Conf.", width: 48, align: "center" },
    { key: "reading", label: "Lectura", width: 50, align: "center" },
    { key: "status", label: "Estado", width: 75 },
    { key: "size", label: "Tamaño", width: 54, align: "right" }
  ];
  drawInventoryHeader(doc, columns);

  data.files.forEach((file, index) => {
    const rowHeight = 38;
    ensureSpace(doc, rowHeight + 2, () => drawInventoryHeader(doc, columns));
    const y = doc.y;
    let cursor = doc.page.margins.left;
    const fill = index % 2 === 0 ? COLORS.white : COLORS.soft;
    const values = {
      number: String(index + 1),
      process: text(file.processCode) || "—",
      period: text(file.academicPeriod) || "Sin periodo",
      type: text(file.detectedLabel) || TYPE_LABELS[file.detectedType] || "No identificado",
      confidence: `${number(file.confidence)}%`,
      reading: text(file.extractionMethod) || "—",
      status: STATUS_LABELS[file.status] || text(file.status) || "Sin estado",
      size: formatBytes(file.sizeBytes)
    };

    columns.forEach((column) => {
      doc.rect(cursor, y, column.width, rowHeight).fillAndStroke(fill, COLORS.line);
      if (column.key === "file") {
        const fileName = pathApiFor(file.path || file.relativePath || "").basename(file.path || file.relativePath || "") || "Sin nombre";
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.text).text(fileName, cursor + 4, y + 5, { width: column.width - 8, height: 11, ellipsis: true });
        doc.font("Helvetica").fontSize(6.6).fillColor(COLORS.muted).text(text(file.relativePath || file.path), cursor + 4, y + 17, { width: column.width - 8, height: 16, ellipsis: true });
      } else {
        const isProblem = column.key === "status" && !["READY", "PROCESSED"].includes(file.status);
        doc.font(column.key === "confidence" ? "Helvetica-Bold" : "Helvetica")
          .fontSize(7)
          .fillColor(isProblem ? COLORS.warning : COLORS.text)
          .text(values[column.key], cursor + 4, y + 12, { width: column.width - 8, height: 18, align: column.align || "left", ellipsis: true });
      }
      cursor += column.width;
    });
    doc.y = y + rowHeight;
  });
}

function writeIssues(doc, data) {
  doc.addPage();
  writeSectionTitle(doc, "Incidencias y documentos que requieren atención", 15);
  if (!data.issues.length) {
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.success).text("No se detectaron incidencias. Todos los archivos quedaron listos o procesados.");
  } else {
    data.issues.forEach((file, index) => {
      const reasons = [...list(file.reasons), ...list(file.errors), ...list(file.warnings)].map(text).filter(Boolean);
      ensureSpace(doc, 78);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.navy).text(`${index + 1}. ${pathApiFor(file.path || "").basename(file.path || "") || "Sin nombre"}`);
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.text)
        .text(`Estado: ${STATUS_LABELS[file.status] || file.status || "Sin estado"} · Tipo: ${file.detectedLabel || TYPE_LABELS[file.detectedType] || "No identificado"} · Confianza: ${number(file.confidence)}%`);
      doc.fillColor(COLORS.muted).text(`Ruta: ${text(file.relativePath || file.path)}`, { lineGap: 2 });
      doc.fillColor(COLORS.warning).text(`Motivo: ${reasons.join(" ") || "El archivo debe ser revisado manualmente."}`, { lineGap: 2 });
      doc.moveDown(0.55);
    });
  }

  const scanErrors = list(data.batch.scanErrors);
  if (scanErrors.length) {
    writeSectionTitle(doc, "Errores al recorrer las carpetas", 13);
    scanErrors.forEach((error, index) => {
      ensureSpace(doc, 34);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.danger).text(`${index + 1}. ${text(error.path) || "Ruta no disponible"}`);
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.text).text(text(error.message) || "No se pudo leer la carpeta.");
      doc.moveDown(0.35);
    });
  }

  if (data.batch.truncated) {
    writeSectionTitle(doc, "Advertencia de límite", 13);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.danger).text("El inventario alcanzó el límite configurado. El PDF no garantiza que se hayan incluido todos los archivos existentes en la carpeta.");
  }
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const footerY = doc.page.height - 24;
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted)
      .text(`SCAN de Procesos Misionales · Página ${index - range.start + 1} de ${range.count}`, doc.page.margins.left, footerY, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
        lineBreak: false
      });
  }
}

async function exportScanReportPdf(snapshot = {}, outputDir) {
  let PDFDocument;
  try { PDFDocument = require("pdfkit"); }
  catch (_error) { throw new Error("Falta instalar la dependencia pdfkit. Ejecuta npm install antes de generar el PDF del SCAN."); }

  const data = buildScanReportData(snapshot);
  if (!text(data.batch.id)) throw new Error("No existe un SCAN válido para exportar.");
  const cleanOutput = ensureDirectory(outputDir);
  const scanDate = new Date(data.batch.scannedAt || data.generatedAt);
  const stamp = Number.isNaN(scanDate.getTime())
    ? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    : scanDate.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const batchSuffix = text(data.batch.id).replace(/[^a-z0-9]/gi, "").slice(-8) || "scan";
  const fileBase = sanitizeFileName(`SCAN_${rootFolderName(data.batch.rootPath)}_${stamp}_${batchSuffix}`, "SCAN_Procesos_Misionales");
  const target = path.join(cleanOutput, `${fileBase}.pdf`);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 34, bottom: 38, left: 34, right: 34 },
      bufferPages: true,
      info: {
        Title: data.title,
        Author: "Gestor de Documentos de Capacitación",
        Subject: "Inventario y clasificación del SCAN de Procesos Misionales"
      }
    });
    const stream = fs.createWriteStream(target);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    doc.font("Helvetica-Bold").fontSize(21).fillColor(COLORS.navy).text(data.title, { align: "center" });
    doc.moveDown(0.35).font("Helvetica").fontSize(9).fillColor(COLORS.muted)
      .text(`Documento generado el ${formatDate(data.generatedAt)}`, { align: "center" });
    doc.moveDown(0.9);

    writeMetadata(doc, data);
    writeSectionTitle(doc, "Resumen del SCAN", 15);
    writeSummaryGrid(doc, data);
    writeCountColumns(doc, "Documentos por tipo", sortedEntries(data.typeCounts, TYPE_LABELS));
    writeCountColumns(doc, "Documentos por estado", sortedEntries(data.statusCounts, STATUS_LABELS));
    writeChips(doc, "Procesos detectados", data.processCodes);
    writeChips(doc, "Periodos académicos detectados", data.academicPeriods);
    writeInventoryTable(doc, data);
    writeIssues(doc, data);
    addPageNumbers(doc);
    doc.end();
  });

  return {
    ok: true,
    filePath: target,
    fileName: path.basename(target),
    totalFiles: data.summary.total,
    issueCount: data.issues.length,
    generatedAt: data.generatedAt
  };
}

module.exports = {
  TYPE_LABELS,
  STATUS_LABELS,
  buildScanReportData,
  exportScanReportPdf
};
