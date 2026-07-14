/* =========================================================
Nombre completo: excel.exporter.js
Ruta o ubicación: /src/exporters/excel.exporter.js
Función o funciones:
- Generar Excel para cuatro tipos documentales.
- Mantener orden y nombres seguros de hojas por tipo documental.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DEFAULT_SHEET_ORDER = [
  "archivos_plan_individual", "identificacion_docente", "capacidades_docente",
  "capacitaciones_propuestas", "formacion_docente",
  "archivos_acuerdo_patrocinio", "datos_acuerdo_patrocinio",
  "apoyos_acuerdo_patrocinio", "responsables_acuerdo_patrocinio",
  "archivos_planificacion_capacitacion", "datos_planificacion_capacitacion",
  "temario_planificacion_capacitacion", "evaluaciones_planificacion_capacitacion",
  "responsables_planificacion_capacitacion", "facilitadores_planificacion_capacitacion",
  "anexos_planificacion_capacitacion", "ocr_paginas_planificacion",
  "archivos_informe_final", "datos_generales_informe", "objetivos_informe",
  "participantes_informe", "certificados_informe", "resumen_certificados_informe",
  "responsables_informe", "anexos_informe", "ocr_paginas_informe"
];

const SHEET_LABELS = {
  archivos_plan_individual: "01_archivos",
  identificacion_docente: "02_identificacion",
  capacidades_docente: "03_capacidades",
  capacitaciones_propuestas: "04_capacitaciones",
  formacion_docente: "05_formacion",
  archivos_acuerdo_patrocinio: "01_archivos",
  datos_acuerdo_patrocinio: "02_datos_acuerdo",
  apoyos_acuerdo_patrocinio: "03_apoyos",
  responsables_acuerdo_patrocinio: "04_responsables",
  archivos_planificacion_capacitacion: "01_archivos",
  datos_planificacion_capacitacion: "02_datos",
  temario_planificacion_capacitacion: "03_temario",
  evaluaciones_planificacion_capacitacion: "04_evaluaciones",
  responsables_planificacion_capacitacion: "05_responsables",
  facilitadores_planificacion_capacitacion: "06_facilitadores",
  anexos_planificacion_capacitacion: "07_anexos",
  ocr_paginas_planificacion: "08_ocr_paginas",
  archivos_informe_final: "01_archivos",
  datos_generales_informe: "02_datos_generales",
  objetivos_informe: "03_objetivos",
  participantes_informe: "04_participantes",
  certificados_informe: "05_certificados",
  resumen_certificados_informe: "06_resumen_certificados",
  responsables_informe: "07_responsables",
  anexos_informe: "08_anexos",
  ocr_paginas_informe: "09_ocr_paginas"
};

function ensureDirectory(dir) {
  const clean = String(dir || "").trim();
  if (!clean) throw new Error("No se recibió carpeta de salida para generar el Excel.");
  if (!fs.existsSync(clean)) fs.mkdirSync(clean, { recursive: true });
  if (!fs.statSync(clean).isDirectory()) throw new Error("La ruta de salida no corresponde a una carpeta válida.");
}
function sanitizeFileName(value) {
  return String(value || "reporte").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ").replace(/\s+/g, "_").replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "").slice(0, 120) || "reporte";
}
function safeSheetName(value, fallback = "Hoja") {
  return String(value || fallback).replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, "_").trim().slice(0, 31) || fallback;
}
function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [key, value == null ? "" : value])
  ));
}
function calculateColumnWidths(rows) {
  const safeRows = normalizeRows(rows);
  const headers = safeRows.length ? Object.keys(safeRows[0]) : [];
  return headers.map((header) => ({
    wch: Math.min(Math.max(safeRows.reduce((max, row) => Math.max(max, String(row[header] ?? "").length), header.length) + 2, 12), 55)
  }));
}
function appendSheet(workbook, name, rows) {
  const safeRows = normalizeRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(safeRows.length ? safeRows : [{}]);
  worksheet["!cols"] = calculateColumnWidths(safeRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(name));
}
function createWorkbookFromTables(tables) {
  const workbook = XLSX.utils.book_new();
  const data = tables || {};
  const ordered = DEFAULT_SHEET_ORDER.filter((name) => Object.prototype.hasOwnProperty.call(data, name));
  const extras = Object.keys(data).filter((name) => !ordered.includes(name));
  const names = [...ordered, ...extras];
  if (!names.length) appendSheet(workbook, "sin_datos", []);
  names.forEach((name) => appendSheet(workbook, SHEET_LABELS[name] || name, data[name]));
  return workbook;
}
function exportTablesToExcel(options = {}) {
  ensureDirectory(options.outputDir);
  const baseName = sanitizeFileName(options.baseName || "reporte");
  const filePath = path.join(options.outputDir, `${baseName}.xlsx`);
  const workbook = createWorkbookFromTables(options.tables || {});
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
