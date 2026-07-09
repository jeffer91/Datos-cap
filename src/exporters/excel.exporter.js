/* =========================================================
Nombre completo: excel.exporter.js
Ruta o ubicación: /plan-docente-extractor/src/exporters/excel.exporter.js
Función o funciones:
- Generar un archivo Excel con cinco hojas no relacionales.
- Convertir cada tabla JSON en una hoja XLSX.
- Aplicar encabezados, anchos de columna y nombres seguros de hoja.
- Guardar el archivo en la carpeta de salida seleccionada por el usuario.
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

  if (!cleanPath) {
    throw new Error("No se recibió carpeta de salida para generar el Excel.");
  }

  if (!fs.existsSync(cleanPath)) {
    fs.mkdirSync(cleanPath, { recursive: true });
  }

  const stat = fs.statSync(cleanPath);

  if (!stat.isDirectory()) {
    throw new Error("La ruta de salida no corresponde a una carpeta válida.");
  }
}

function sanitizeFileName(value) {
  return String(value || "reporte_plan_individual")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "reporte_plan_individual";
}

function safeSheetName(value, fallback = "Hoja") {
  const clean = String(value || fallback)
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 31);

  return clean || fallback.slice(0, 31);
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

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
    const maxContent = safeRows.reduce((max, row) => {
      const value = String(row[header] ?? "");
      return Math.max(max, value.length);
    }, header.length);

    return {
      wch: Math.min(Math.max(maxContent + 2, 12), 55)
    };
  });
}

function appendSheet(workbook, sheetName, rows) {
  const safeRows = normalizeRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(safeRows.length ? safeRows : [{}], {
    skipHeader: false
  });

  worksheet["!cols"] = calculateColumnWidths(safeRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
}

function createWorkbookFromTables(tables) {
  const workbook = XLSX.utils.book_new();
  const data = tables || {};
  const orderedNames = DEFAULT_SHEET_ORDER.filter((name) => Object.prototype.hasOwnProperty.call(data, name));
  const extraNames = Object.keys(data).filter((name) => !orderedNames.includes(name));
  const allNames = [...orderedNames, ...extraNames];

  if (!allNames.length) {
    appendSheet(workbook, "sin_datos", []);
    return workbook;
  }

  allNames.forEach((tableName) => {
    appendSheet(workbook, SHEET_LABELS[tableName] || tableName, data[tableName]);
  });

  return workbook;
}

function exportTablesToExcel(options) {
  const config = options || {};
  const outputDir = config.outputDir;
  const tables = config.tables || {};
  const baseName = sanitizeFileName(config.baseName || "reporte_plan_individual");
  const filePath = path.join(outputDir, `${baseName}.xlsx`);

  ensureDirectory(outputDir);

  const workbook = createWorkbookFromTables(tables);
  XLSX.writeFile(workbook, filePath, {
    bookType: "xlsx",
    compression: true
  });

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
