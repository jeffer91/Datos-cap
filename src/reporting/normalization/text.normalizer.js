/* =========================================================
Nombre completo: text.normalizer.js
Ruta o ubicación: /src/reporting/normalization/text.normalizer.js
Función o funciones:
- Normalizar texto sin alterar los datos originales almacenados.
- Preparar claves comparables para personas, cursos, carreras y periodos.
- Limpiar identificaciones y valores vacíos de forma uniforme.
========================================================= */

"use strict";

const MONTHS = Object.freeze({
  enero: "01",
  febrero: "02",
  marzo: "03",
  abril: "04",
  mayo: "05",
  junio: "06",
  julio: "07",
  agosto: "08",
  septiembre: "09",
  setiembre: "09",
  octubre: "10",
  noviembre: "11",
  diciembre: "12"
});

function displayText(value) {
  return String(value === null || typeof value === "undefined" ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
}

function foldText(value) {
  return displayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeKey(value) {
  return foldText(value)
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentity(value) {
  return displayText(value).replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function firstNonEmpty(record, fields) {
  const source = record || {};
  for (const field of fields || []) {
    const value = displayText(source[field]);
    if (value) return value;
  }
  return "";
}

function normalizePeriod(value) {
  const original = displayText(value);
  if (!original) return "";

  const numeric = original.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])\b/);
  if (numeric) return `${numeric[1]}-${String(numeric[2]).padStart(2, "0")}`;

  const reversed = original.match(/\b(0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (reversed) return `${reversed[2]}-${String(reversed[1]).padStart(2, "0")}`;

  const folded = foldText(original);
  const monthName = Object.keys(MONTHS).find((month) => folded.includes(month));
  const year = folded.match(/\b(20\d{2})\b/);
  if (monthName && year) return `${year[1]}-${MONTHS[monthName]}`;

  const rangeYears = [...folded.matchAll(/\b(20\d{2})\b/g)].map((match) => match[1]);
  if (rangeYears.length) return rangeYears.join("-");

  return normalizeKey(original).replace(/\s+/g, "-");
}

function normalizeYesNo(value) {
  const key = normalizeKey(value);
  if (["si", "sí", "yes", "true", "1", "x"].includes(key)) return "SI";
  if (["no", "false", "0"].includes(key)) return "NO";
  return displayText(value).toUpperCase();
}

function compactObject(value) {
  return Object.entries(value || {}).reduce((output, [key, item]) => {
    if (item === "" || item === null || typeof item === "undefined") return output;
    if (Array.isArray(item) && !item.length) return output;
    output[key] = item;
    return output;
  }, {});
}

module.exports = {
  MONTHS,
  displayText,
  foldText,
  normalizeKey,
  normalizeIdentity,
  firstNonEmpty,
  normalizePeriod,
  normalizeYesNo,
  compactObject
};
