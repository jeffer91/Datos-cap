/* =========================================================
Nombre completo: excel.exporter.js
Ruta o ubicación: /src/exporters/excel.exporter.js
Función o funciones:
- Generar archivos Excel con un número variable de hojas.
- Recibir orden y etiquetas de hojas desde cada tipo documental.
- Convertir cada tabla JSON en una hoja XLSX.
- Mantener compatibilidad con las cinco tablas del Plan Individual.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DEFAULT_SHEET_ORDER = [
  "archivos_plan_individual",
  "identificacion_docente",
  "capacidades_docente",
  "capacitaciones_propuestas",
  "formacion_docente"
];

const SHEET_LABELS = {
  archivos_plan_individual: "01_archivos",
  identificacion_docente: "02_identificacion",
  capacidades_docente: "03_capacidades",
  capacitaciones_propuestas: "04_capacitaciones",
  formacion_docente: "05_formacion"
};

function ensureDirectory(directoryPath) {
  const cleanPath = String(directoryPath || "").trim();
  if (!cleanPath) throw new Error("No se recibió carpeta de salida para generar el Excel.");
  if (!fs.existsSync(cleanPath)) fs.mkdirSync(cleanPath, { recursive: true });
  const stat = fs.statSync(cleanPath);
  if (!stat.isDirectory()) throw new Error("La ruta de salida no corresponde a una carpeta válida.");
}

function sanitizeFileName(value) {
  return String(value || "reporte_documental")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "reporte_documental";
}

function safeSheetName(value, fallback = "Hoja") {
  const clean = String(value || fallback)
    .replace(/[\\/?*\[\]:]/g, " ")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 31);
  return clean || fallback.slice(0, 31);
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const output = {};
    Object.keys(row || {}).forEach((key) => {
      const value = row[key];
      output[key] = typeof value === "undefined" || value === null ? "" : value;
    });
    return output;
  });
}

function calculateColumnWidths(rows) {
  const safeRows = normalizeRows(rows);
  const headers = safeRows.length ? Object.keys(safeRows[0]) : [];
  return headers.map((header) => {
    const maxContent = safeRows.reduce((max, row) => Math.max(max, String(row[header] ?? "").length), header.length);
    return { wch: Math.min(Math.max(maxContent + 2, 12), 55) };
  });
}

function appendSheet(workbook, sheetName, rows) {
  const safeRows = normalizeRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(safeRows.length ? safeRows : [{}], { skipHeader: false });
  worksheet["!cols"] = calculateColumnWidths(safeRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
}

function createWorkbookFromTables(tables, options = {}) {
  const workbook = XLSX.utils.book_new();
  const data = tables || {};
  const requestedOrder = Array.isArray(options.sheetOrder) && options.sheetOrder.length
    ? options.sheetOrder
    : DEFAULT_SHEET_ORDER;
  const labels = { ...SHEET_LABELS, ...(options.sheetLabels || {}) };
  const orderedNames = requestedOrder.filter((name) => Object.prototype.hasOwnProperty.call(data, name));
  const extraNames = Object.keys(data).filter((name) => !orderedNames.includes(name));
  const allNames = [...orderedNames, ...extraNames];

  if (!allNames.length) {
    appendSheet(workbook, "sin_datos", []);
    return workbook;
  }

  allNames.forEach((tableName) => appendSheet(workbook, labels[tableName] || tableName, data[tableName]));
  return workbook;
}

function exportTablesToExcel(options) {
  const config = options || {};
  const outputDir = config.outputDir;
  const tables = config.tables || {};
  const baseName = sanitizeFileName(config.baseName || "reporte_documental");
  const filePath = path.join(outputDir, `${baseName}.xlsx`);

  ensureDirectory(outputDir);
  const workbook = createWorkbookFromTables(tables, {
    sheetOrder: config.sheetOrder,
    sheetLabels: config.sheetLabels
  });
  XLSX.writeFile(workbook, filePath, { bookType: "xlsx", compression: true });

  return {
    ok: true,
    filePath,
    fileName: path.basename(filePath),
    sheetCount: workbook.SheetNames.length,
    sheets: workbook.SheetNames
  };
}

module.exports = {
  DEFAULT_SHEET_ORDER,
  SHEET_LABELS,
  ensureDirectory,
  sanitizeFileName,
  safeSheetName,
  normalizeRows,
  calculateColumnWidths,
  createWorkbookFromTables,
  exportTablesToExcel
};
