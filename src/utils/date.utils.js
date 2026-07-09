/* =========================================================
Nombre completo: date.utils.js
Ruta o ubicación: /plan-docente-extractor/src/utils/date.utils.js
Función o funciones:
- Centralizar funciones de fecha y hora para nombres de reporte.
- Generar marcas de tiempo seguras para archivos.
- Normalizar fechas en texto extraídas desde PDF.
- Detectar años o rangos de fecha potencialmente sospechosos.
========================================================= */

"use strict";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function createTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate())
  ].join("") + "_" + [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds())
  ].join("");
}

function createIsoTimestamp(date = new Date()) {
  return date.toISOString();
}

function createReportBaseName(prefix = "reporte_plan_individual", date = new Date()) {
  return `${prefix}_${createTimestamp(date)}`;
}

function normalizeDateText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+al\s+/gi, " al ")
    .replace(/\s+a\s+/gi, " al ")
    .replace(/\s*hasta\s*/gi, " al ")
    .replace(/\s*[-–—]\s*/g, " al ")
    .trim();
}

function extractYear(value) {
  const text = String(value || "");
  const match = text.match(/(19\d{2}|20\d{2})/);
  return match ? Number(match[1]) : 0;
}

function isSuspiciousYear(year, options = {}) {
  const currentYear = Number(options.currentYear || new Date().getFullYear());
  const minYear = Number(options.minYear || 2000);
  const maxFutureYears = Number(options.maxFutureYears || 5);
  const numericYear = Number(year || 0);

  if (!numericYear) {
    return false;
  }

  return numericYear < minYear || numericYear > currentYear + maxFutureYears;
}

function isSuspiciousDateRange(startDateText, endDateText, options = {}) {
  const startYear = extractYear(startDateText);
  const endYear = extractYear(endDateText);

  if (isSuspiciousYear(startYear, options) || isSuspiciousYear(endYear, options)) {
    return true;
  }

  if (startYear && endYear && endYear < startYear) {
    return true;
  }

  const maxRangeYears = Number(options.maxRangeYears || 3);

  if (startYear && endYear && endYear - startYear > maxRangeYears) {
    return true;
  }

  return false;
}

module.exports = {
  pad2,
  createTimestamp,
  createIsoTimestamp,
  createReportBaseName,
  normalizeDateText,
  extractYear,
  isSuspiciousYear,
  isSuspiciousDateRange
};
