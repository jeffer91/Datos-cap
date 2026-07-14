/* =========================================================
Nombre completo: normalizer.js
Ruta o ubicación: /src/extractor/normalizer.js
Función o funciones:
- Normalizar texto extraído desde PDF u OCR.
- Limpiar saltos, guiones, espacios y caracteres defectuosos.
- Reconocer códigos institucionales de distintos procesos.
========================================================= */
"use strict";

function asText(value) { return String(value ?? ""); }
function normalizeHyphenBreaks(text) {
  return asText(text)
    .replace(/\uFFFE/g, "-")
    .replace(/\u00AD/g, "")
    .replace(/\s*-\s*\n\s*/g, "-")
    .replace(/￾/g, "-");
}
function normalizeLineBreaks(text) {
  return normalizeHyphenBreaks(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\t\v\f]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .replace(/[ ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function normalizeSpaces(text) { return normalizeLineBreaks(text).replace(/\s+/g, " ").trim(); }
function removeAccents(text) { return asText(text).normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function normalizeForSearch(text) { return removeAccents(normalizeSpaces(text)).toLowerCase().trim(); }
function splitCleanLines(text) {
  return normalizeLineBreaks(text).split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}
function cleanValue(value) {
  return normalizeSpaces(value).replace(/^[:\-–—\s]+/, "").replace(/[:\-–—\s]+$/, "").trim();
}
function firstMatch(text, patterns, groupIndex = 1) {
  const source = normalizeLineBreaks(text);
  const list = Array.isArray(patterns) ? patterns : [patterns];
  for (const pattern of list) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
    const match = source.match(regex);
    if (match && typeof match[groupIndex] !== "undefined") {
      const value = cleanValue(match[groupIndex]);
      if (value) return value;
    }
  }
  return "";
}
function findValueByLabel(text, labels, options = {}) {
  const lines = splitCleanLines(text);
  const labelList = Array.isArray(labels) ? labels : [labels];
  const maxLookAhead = Number.isFinite(options.maxLookAhead) ? options.maxLookAhead : 2;
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];
    const currentSearch = normalizeForSearch(current);
    for (const label of labelList) {
      const labelSearch = normalizeForSearch(label);
      if (!labelSearch || !currentSearch.includes(labelSearch)) continue;
      const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inlineMatch = current.match(new RegExp(`${escaped}\\s*:?\\s*(.+)$`, "i"));
      if (inlineMatch && cleanValue(inlineMatch[1])) return cleanValue(inlineMatch[1]);
      for (let step = 1; step <= maxLookAhead; step += 1) {
        const next = lines[index + step];
        if (next && cleanValue(next)) return cleanValue(next);
      }
    }
  }
  return "";
}
function extractBetween(text, startLabels, endLabels) {
  const source = normalizeLineBreaks(text);
  const search = removeAccents(source).toLowerCase();
  const starts = Array.isArray(startLabels) ? startLabels : [startLabels];
  const ends = Array.isArray(endLabels) ? endLabels : [endLabels];
  let startIndex = -1;
  let startLength = 0;
  for (const label of starts) {
    const clean = removeAccents(asText(label)).toLowerCase().trim();
    const found = search.indexOf(clean);
    if (found >= 0 && (startIndex === -1 || found < startIndex)) {
      startIndex = found;
      startLength = clean.length;
    }
  }
  if (startIndex < 0) return "";
  const from = startIndex + startLength;
  let endIndex = source.length;
  for (const label of ends) {
    const clean = removeAccents(asText(label)).toLowerCase().trim();
    const found = search.indexOf(clean, from);
    if (found >= 0 && found < endIndex) endIndex = found;
  }
  return cleanValue(source.slice(from, endIndex));
}
function normalizeCodigoDocumento(value) {
  return normalizeSpaces(value)
    .replace(/[￾\uFFFE]/g, "-")
    .replace(/\s*[-–—]\s*/g, "-")
    .replace(/UGPA\s*-\s*/gi, "UGPA-")
    .replace(/(RGI1|RGI2|INF|RI\d+)\s*-\s*/gi, "$1-")
    .replace(/PRO\s*-?\s*/gi, "PRO-")
    .replace(/-+/g, "-")
    .toUpperCase();
}
function parseCodigoDocumento(text, expectedProcess = "") {
  const compact = normalizeCodigoDocumento(text);
  const processFilter = String(expectedProcess || "").replace(/\D/g, "");
  const matches = compact.match(/UGPA-(?:RGI1|RGI2|INF|RI\d+)-\d{1,3}-PRO-\d{1,3}-\d{4}-\d{2}/gi) || [];
  if (!matches.length) return "";
  if (processFilter) {
    const expected = matches.find((code) => new RegExp(`-PRO-${processFilter}-`, "i").test(code));
    if (expected) return expected;
  }
  return matches[0];
}
function normalizeDateText(value) {
  return cleanValue(value).replace(/\s+al\s+/gi, " al ").replace(/\s+a\s+/gi, " al ")
    .replace(/\s*[-–—]\s*/g, " al ").replace(/\s+/g, " ");
}
function uniqueValues(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const clean = cleanValue(value);
    const key = normalizeForSearch(clean);
    if (clean && !seen.has(key)) { seen.add(key); output.push(clean); }
  }
  return output;
}

module.exports = {
  asText,
  normalizeHyphenBreaks,
  normalizeLineBreaks,
  normalizeSpaces,
  removeAccents,
  normalizeForSearch,
  splitCleanLines,
  cleanValue,
  firstMatch,
  findValueByLabel,
  extractBetween,
  normalizeCodigoDocumento,
  parseCodigoDocumento,
  normalizeDateText,
  uniqueValues
};
