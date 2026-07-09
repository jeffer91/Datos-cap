/* =========================================================
Nombre completo: normalizer.js
Ruta o ubicación: /plan-docente-extractor/src/extractor/normalizer.js
Función o funciones:
- Normalizar texto extraído desde PDF.
- Limpiar saltos de línea, espacios, guiones rotos y caracteres extraños.
- Extraer valores por etiquetas frecuentes del plan individual.
- Preparar textos para búsquedas robustas sin alterar el contenido original.
========================================================= */

"use strict";

function asText(value) {
  return String(value ?? "");
}

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

function normalizeSpaces(text) {
  return normalizeLineBreaks(text)
    .replace(/\s+/g, " ")
    .trim();
}

function removeAccents(text) {
  return asText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeForSearch(text) {
  return removeAccents(normalizeSpaces(text))
    .toLowerCase()
    .trim();
}

function splitCleanLines(text) {
  return normalizeLineBreaks(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanValue(value) {
  return normalizeSpaces(value)
    .replace(/^[:\-–—\s]+/, "")
    .replace(/[:\-–—\s]+$/, "")
    .trim();
}

function firstMatch(text, patterns, groupIndex = 1) {
  const source = normalizeLineBreaks(text);
  const list = Array.isArray(patterns) ? patterns : [patterns];

  for (const pattern of list) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
    const match = source.match(regex);

    if (match && typeof match[groupIndex] !== "undefined") {
      const value = cleanValue(match[groupIndex]);

      if (value) {
        return value;
      }
    }
  }

  return "";
}

function findValueByLabel(text, labels, options = {}) {
  const lines = splitCleanLines(text);
  const labelList = Array.isArray(labels) ? labels : [labels];
  const maxLookAhead = Number.isFinite(options.maxLookAhead) ? options.maxLookAhead : 2;

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i];
    const currentSearch = normalizeForSearch(current);

    for (const label of labelList) {
      const labelSearch = normalizeForSearch(label);

      if (!labelSearch || !currentSearch.includes(labelSearch)) {
        continue;
      }

      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const inlineRegex = new RegExp(`${escapedLabel}\\s*:?\\s*(.+)$`, "i");
      const inlineMatch = current.match(inlineRegex);

      if (inlineMatch && cleanValue(inlineMatch[1])) {
        return cleanValue(inlineMatch[1]);
      }

      for (let step = 1; step <= maxLookAhead; step += 1) {
        const next = lines[i + step];

        if (next && cleanValue(next)) {
          return cleanValue(next);
        }
      }
    }
  }

  return "";
}

function extractBetween(text, startLabels, endLabels) {
  const source = normalizeLineBreaks(text);
  const search = normalizeForSearch(source);
  const starts = Array.isArray(startLabels) ? startLabels : [startLabels];
  const ends = Array.isArray(endLabels) ? endLabels : [endLabels];

  let startIndex = -1;
  let startLabelLength = 0;

  for (const label of starts) {
    const cleanLabel = normalizeForSearch(label);
    const found = search.indexOf(cleanLabel);

    if (found >= 0 && (startIndex === -1 || found < startIndex)) {
      startIndex = found;
      startLabelLength = cleanLabel.length;
    }
  }

  if (startIndex < 0) {
    return "";
  }

  let endIndex = search.length;
  const from = startIndex + startLabelLength;

  for (const label of ends) {
    const cleanLabel = normalizeForSearch(label);
    const found = search.indexOf(cleanLabel, from);

    if (found >= 0 && found < endIndex) {
      endIndex = found;
    }
  }

  const compactBefore = search.slice(0, from);
  const originalStart = compactBefore.length;
  const originalEnd = Math.max(originalStart, endIndex);

  return cleanValue(source.slice(originalStart, originalEnd));
}

function parseCodigoDocumento(text) {
  const compact = normalizeSpaces(text)
    .replace(/\s*[-–—]\s*/g, "-")
    .replace(/UGPA\s*-\s*/gi, "UGPA-")
    .replace(/RGI1\s*-\s*/gi, "RGI1-")
    .replace(/PRO\s*-\s*/gi, "PRO-");

  const match = compact.match(/UGPA-RGI1-\d{1,3}-PRO-?251-\d{4}-\d{2}/i);

  return match ? match[0].toUpperCase().replace(/PRO251/i, "PRO-251") : "";
}

function normalizeDateText(value) {
  return cleanValue(value)
    .replace(/\s+al\s+/gi, " al ")
    .replace(/\s+a\s+/gi, " al ")
    .replace(/\s*[-–—]\s*/g, " al ")
    .replace(/\s+/g, " ");
}

function uniqueValues(values) {
  const seen = new Set();
  const output = [];

  for (const value of values || []) {
    const clean = cleanValue(value);
    const key = normalizeForSearch(clean);

    if (clean && !seen.has(key)) {
      seen.add(key);
      output.push(clean);
    }
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
  parseCodigoDocumento,
  normalizeDateText,
  uniqueValues
};
