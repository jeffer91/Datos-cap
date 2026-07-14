/* =========================================================
Nombre completo: participants.parser.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/participants.parser.js
Función o funciones:
- Interpretar matrices de participantes con columnas variables.
- Admitir nombres y datos divididos en varias líneas.
- Conservar la fila original y marcar información dudosa.
========================================================= */
"use strict";

const {
  normalizeLineBreaks,
  normalizeForSearch,
  splitCleanLines,
  cleanValue
} = require("../../extractor/normalizer");
const { createRowId } = require("../../utils/ids");

const PARTICIPANT_TYPES = ["Docente", "Estudiante", "Administrativo", "Facilitador", "Colaborador"];
const STUDY_LEVELS = ["Tercer Nivel", "Cuarto Nivel", "Bachillerato", "Tecnología", "Maestría", "Doctorado"];

function extractParticipantsSection(text) {
  const source = normalizeLineBreaks(text);
  const startMatch = /MATRIZ\s+CON\s+LOS\s+DATOS\s+DE\s+LOS\s+PARTICIPANTES\s*:?/i.exec(source);
  if (!startMatch) return "";
  const from = startMatch.index + startMatch[0].length;
  const remaining = source.slice(from);
  const endPatterns = [
    /\n\s*\d+\.?\s*CERTIFICADOS?\s+A\s+ENTREGAR/i,
    /\n\s*\d+\.?\s*RES[ÚU]MEN\s+ENTREGA\s+DE\s+CERTIFICADOS/i,
    /\n\s*\d+\.?\s*CONCLUSIONES/i,
    /\n\s*\d+\.?\s*ANEXOS?/i
  ];
  let end = remaining.length;
  endPatterns.forEach((pattern) => {
    const match = pattern.exec(remaining);
    if (match && match.index < end) end = match.index;
  });
  return remaining.slice(0, end).trim();
}

function isNoiseLine(line) {
  const value = normalizeForSearch(line);
  if (!value) return true;
  return /^(n[º°o.]?|nombres y apellidos|cedula de identidad|nivel de estudios|tipo participante|tiene discapacidad|tipo de discapacidad|posee carne|genero)$/.test(value) ||
    /^pagina\s+\d+/i.test(value) ||
    value.includes("unidad de gestion de procesos academicos") ||
    value.startsWith("codigo:") ||
    value.startsWith("version:") ||
    value.startsWith("fecha de elaboracion:") ||
    value.startsWith("informe final de la capacitacion");
}

function normalizeGender(value) {
  const search = normalizeForSearch(value);
  if (/\bfemenino\b|\bf\b/.test(search)) return "Femenino";
  if (/\bmasculino\b|\bm\b/.test(search)) return "Masculino";
  if (/\botro\b|\bno binario\b/.test(search)) return "Otro";
  return "";
}

function findKnownValue(text, values) {
  const search = normalizeForSearch(text);
  return values.find((value) => search.includes(normalizeForSearch(value))) || "";
}

function extractDisabilityData(suffix) {
  const search = normalizeForSearch(suffix);
  const hasDisability = /\bsi\b/.test(search) && !/\bno\b/.test(search.split("si")[0].slice(-12))
    ? "SI"
    : /\bno\b/.test(search) ? "NO" : "";
  const disabilityType = /ninguna|ninguno|\s-\s/.test(search) ? "Ninguna" : "";
  const hasCard = /carne/.test(search)
    ? (/carne.{0,20}\bsi\b/.test(search) ? "SI" : /carne.{0,20}\bno\b/.test(search) ? "NO" : "")
    : (/\bno\b/.test(search) ? "NO" : "");
  return { hasDisability, disabilityType, hasCard };
}

function parseParticipantSegment(segment, context, index) {
  const raw = cleanValue(segment.raw);
  const idMatch = raw.match(/\b\d{9,10}\b/);
  const cedula = idMatch ? idMatch[0].padStart(10, "0") : "";
  const before = idMatch ? raw.slice(0, idMatch.index) : raw;
  const after = idMatch ? raw.slice(idMatch.index + idMatch[0].length) : "";
  const numberMatch = before.match(/^\s*(\d{1,3})\s+/);
  const numero = numberMatch ? Number(numberMatch[1]) : (segment.numero || index + 1);
  const name = cleanValue(before.replace(/^\s*\d{1,3}\s+/, "").replace(/\bN[º°o.]?\b/gi, ""));
  const studyLevel = findKnownValue(after, STUDY_LEVELS);
  const participantType = findKnownValue(after, PARTICIPANT_TYPES);
  const gender = normalizeGender(after);
  const disability = extractDisabilityData(after);
  const warnings = [];
  if (!name || name.length < 5) warnings.push("No se pudo reconstruir completamente el nombre.");
  if (!cedula) warnings.push("No se detectó cédula.");
  if (!gender) warnings.push("No se detectó género.");

  return {
    id: createRowId("participante-informe", context.id_documento, index, `${cedula}|${name}`),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    numero,
    nombres_apellidos: name,
    cedula,
    nivel_estudios: studyLevel,
    tipo_participante: participantType,
    tiene_discapacidad: disability.hasDisability,
    tipo_discapacidad: disability.disabilityType,
    posee_carne_discapacidad: disability.hasCard,
    genero: gender,
    fila_original: raw,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function createParticipantRows(text, context) {
  const section = extractParticipantsSection(text);
  if (!section) return [];
  const lines = splitCleanLines(section).filter((line) => !isNoiseLine(line));
  const segments = [];
  let pendingLines = [];
  let current = null;

  function finishCurrent() {
    if (!current) return;
    current.raw = [...current.lines].join(" ");
    segments.push(current);
    current = null;
  }

  for (const line of lines) {
    const hasId = /\b\d{9,10}\b/.test(line);
    const startsRow = /^\s*\d{1,3}\s+/.test(line);

    if (startsRow && current && !hasId) {
      finishCurrent();
      pendingLines = [line];
      continue;
    }

    if (hasId) {
      finishCurrent();
      const combined = [...pendingLines, line].join(" ");
      const numberMatch = combined.match(/^\s*(\d{1,3})\s+/);
      current = {
        numero: numberMatch ? Number(numberMatch[1]) : segments.length + 1,
        lines: [combined]
      };
      pendingLines = [];
      continue;
    }

    if (current) current.lines.push(line);
    else pendingLines.push(line);
  }
  finishCurrent();

  return segments
    .map((segment, index) => parseParticipantSegment(segment, context, index))
    .filter((row) => row.nombres_apellidos || row.cedula);
}

module.exports = {
  PARTICIPANT_TYPES,
  STUDY_LEVELS,
  extractParticipantsSection,
  normalizeGender,
  parseParticipantSegment,
  createParticipantRows
};
