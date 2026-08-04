/* =========================================================
Nombre completo: path-context.parser.js
Ruta o ubicación: /src/importacion-masiva/path-context.parser.js
Función o funciones:
- Interpretar proceso, periodo académico y tipo documental probable desde rutas.
- Diferenciar el periodo académico de la fecha o mes del documento.
- Conservar la trazabilidad de carpetas durante importaciones masivas.
========================================================= */
"use strict";

const { toDisplayPath, pathApiFor } = require("../utils/file.utils");

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

const DOCUMENT_HINTS = Object.freeze([
  { type: "plan-individual", patterns: ["plan individual", "formacion individual", "capacitacion individual"] },
  { type: "acuerdo-patrocinio", patterns: ["acuerdo de patrocinio", "acuerdos de patrocinio", "patrocinio institucional"] },
  { type: "planificacion-capacitacion", patterns: ["planificacion de capacitacion", "planificaciones de capacitacion", "planificacion capacitacion"] },
  { type: "informe-final-capacitacion", patterns: ["informe final", "informes finales", "reporte de resultados", "reportes de resultados"] },
  { type: "instrumento-evaluacion", patterns: ["instrumento de evaluacion", "instrumentos de evaluacion", "encuesta de evaluacion", "ficha de evaluacion"] },
  { type: "informe-impacto", patterns: ["informe de impacto", "informes de impacto", "medicion de impacto", "evaluacion de impacto"] }
]);

function text(value) { return String(value == null ? "" : value).trim(); }
function normalized(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizedWords(value) {
  return normalized(value)
    .replace(/[-/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseMonth(value) {
  const clean = normalized(value);
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "";
}

function parseAcademicPeriod(value) {
  const source = normalized(value);
  const monthNames = Object.keys(MONTHS).join("|");
  const pattern = new RegExp(`\\b(${monthNames})\\s+(20\\d{2})\\s*(?:-|a|hasta)\\s*(${monthNames})\\s+(20\\d{2})\\b`, "i");
  const match = source.match(pattern);
  if (!match) return null;
  const startMonth = MONTHS[normalized(match[1])];
  const endMonth = MONTHS[normalized(match[3])];
  return {
    label: `${titleCaseMonth(match[1])} ${match[2]}–${titleCaseMonth(match[3])} ${match[4]}`,
    start: `${match[2]}-${startMonth}`,
    end: `${match[4]}-${endMonth}`,
    sourceText: match[0]
  };
}

function parseDocumentMonth(value) {
  const source = text(value);
  const matches = [...source.matchAll(/((?:19|20)\d{2})[-_\s](0?[1-9]|1[0-2])/g)];
  if (!matches.length) return "";
  const last = matches[matches.length - 1];
  return `${last[1]}-${String(Number(last[2])).padStart(2, "0")}`;
}

function extractProcessCodes(value) {
  const source = text(value);
  return [...source.matchAll(/\bPRO\s*[-_]?\s*(\d{3})\b/gi)].map((match) => `PRO-${match[1]}`);
}

function detectPathHint(segments, fileName) {
  const candidates = [...(segments || []), fileName].map((item) => ({ original: text(item), normalized: normalizedWords(item) }));
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    for (const definition of DOCUMENT_HINTS) {
      const pattern = definition.patterns.find((item) => candidate.normalized.includes(item));
      if (pattern) {
        return {
          type: definition.type,
          confidence: candidate === candidates[candidates.length - 1] ? 88 : 78,
          source: candidate.original,
          pattern
        };
      }
    }
  }
  return null;
}

function nearestDocumentFolder(segments) {
  for (let index = (segments || []).length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (detectPathHint([segment], "")) return segment;
  }
  return "";
}

function parsePathContext(entry = {}) {
  const rootPath = toDisplayPath(entry.rootPath || "");
  const filePath = toDisplayPath(entry.path || "");
  const pathApi = pathApiFor(rootPath || filePath);
  const relativePath = text(entry.relativePath) || (rootPath && filePath ? pathApi.relative(rootPath, filePath) : pathApi.basename(filePath));
  const fileName = pathApi.basename(filePath);
  const directory = pathApi.dirname(relativePath);
  const segments = directory && directory !== "." ? directory.split(/[\\/]+/).filter(Boolean) : [];
  const searchable = [...segments, fileName].join(" | ");
  const academicPeriod = [...segments].reverse().map(parseAcademicPeriod).find(Boolean) || parseAcademicPeriod(searchable);
  const processCodes = extractProcessCodes(searchable);
  const pathHint = detectPathHint(segments, fileName);

  return {
    rootPath,
    relativePath,
    fileName,
    directorySegments: segments,
    processCode: processCodes.length ? processCodes[processCodes.length - 1] : "",
    processCodes: [...new Set(processCodes)],
    academicPeriod: academicPeriod?.label || "",
    academicPeriodStart: academicPeriod?.start || "",
    academicPeriodEnd: academicPeriod?.end || "",
    academicPeriodSource: academicPeriod?.sourceText || "",
    documentMonth: parseDocumentMonth(fileName),
    documentFolder: nearestDocumentFolder(segments),
    pathHint
  };
}

module.exports = {
  MONTHS,
  DOCUMENT_HINTS,
  normalized,
  normalizedWords,
  parseAcademicPeriod,
  parseDocumentMonth,
  extractProcessCodes,
  detectPathHint,
  parsePathContext
};
