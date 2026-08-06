"use strict";

const TRAINING_TYPES = [
  "APROBACIÓN", "APROBACION", "CERTIFICACIÓN", "CERTIFICACION", "ASISTENCIA",
  "CURSO", "TALLER", "SEMINARIO", "CONGRESO", "DIPLOMADO", "CAPACITACIÓN", "CAPACITACION"
];

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000\ufffe\uffff\ufffd]/g, "-")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compact(value) {
  return clean(value).replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tableSection(text) {
  const source = clean(text);
  const startPatterns = [
    /(?:^|\n)\s*4\.?\s*Resumen\s+de\s+Capacitaci[oó]n(?:es)?\s+Propuestas?\s*(?:\n|$)/i,
    /(?:^|\n)\s*Resumen\s+de\s+Capacitaci[oó]n(?:es)?\s+Propuestas?\s*(?:\n|$)/i
  ];
  let start = -1;
  let startLength = 0;
  for (const pattern of startPatterns) {
    const match = pattern.exec(source);
    if (match && match.index != null) {
      start = match.index;
      startLength = match[0].length;
      break;
    }
  }
  if (start < 0) return "";
  const tail = source.slice(start + startLength);
  const endMatch = /(?:^|\n)\s*5\.?\s*Indicadores?\b/i.exec(tail)
    || /(?:^|\n)\s*6\.?\s*Actividades?\b/i.exec(tail);
  return clean(endMatch && endMatch.index != null ? tail.slice(0, endMatch.index) : tail);
}

function isHeaderLine(line) {
  const value = normalize(line);
  return !value
    || value === "#"
    || value === "nombre de capacitacion propuesta"
    || value === "horas de capacitacion propuesta"
    || value === "fecha de propuesta de ejecucion"
    || value === "tipo de capacitacion propuesta"
    || value === "nombre de"
    || value === "capacitacion"
    || value === "propuesta"
    || value === "horas de"
    || value === "fecha de"
    || value === "propuesta de"
    || value === "ejecucion"
    || value === "tipo de capacitacion";
}

function collectRowBlocks(section) {
  const lines = clean(section).split("\n").map((line) => line.trim()).filter((line) => !isHeaderLine(line));
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const rowWithText = line.match(/^\s*(\d{1,2})[.)]?\s+(.+)$/);
    const rowOnly = line.match(/^\s*(\d{1,2})[.)]?\s*$/);
    const rowNumber = Number(rowWithText?.[1] || rowOnly?.[1] || 0);
    if (rowNumber > 0 && rowNumber <= 30) {
      if (current) blocks.push(current);
      current = {
        order: rowNumber,
        lines: rowWithText?.[2] ? [rowWithText[2].trim()] : []
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

function findType(value) {
  const source = compact(value);
  for (const type of TRAINING_TYPES) {
    const pattern = new RegExp(`\\b${type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const match = pattern.exec(source);
    if (match) return { value: match[0], index: match.index, length: match[0].length };
  }
  return { value: "", index: -1, length: 0 };
}

function findDateRange(value) {
  const source = compact(value)
    .replace(/\bDesdo\b/gi, "Desde")
    .replace(/\bhasta\s+el\b/gi, "hasta el");
  const match = /\bDesde\s+(.+?)\s+(?:hasta|al)\s+(.+?)(?=\s+(?:APROBACI[ÓO]N|CERTIFICACI[ÓO]N|ASISTENCIA|CURSO|TALLER|SEMINARIO|CONGRESO|DIPLOMADO|CAPACITACI[ÓO]N)\b|$)/i.exec(source);
  if (!match || match.index == null) return { original: "", start: "", end: "", index: -1, length: 0 };
  return {
    original: compact(match[0]),
    start: compact(match[1]),
    end: compact(match[2]),
    index: match.index,
    length: match[0].length
  };
}

function validHoursCandidate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= 1000 && number < 1900;
}

function parseRow(block) {
  let source = compact(block?.lines?.join(" ") || "");
  if (!source) return null;

  const type = findType(source);
  if (type.index >= 0) {
    source = compact(`${source.slice(0, type.index)} ${source.slice(type.index + type.length)}`);
  }

  const date = findDateRange(source);
  let beforeDate = source;
  if (date.index >= 0) {
    beforeDate = compact(source.slice(0, date.index));
  }

  const numericMatches = [...beforeDate.matchAll(/\b(\d{1,4})\b/g)]
    .filter((match) => validHoursCandidate(match[1]));
  const hoursMatch = numericMatches[numericMatches.length - 1] || null;
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  let name = beforeDate;
  if (hoursMatch && hoursMatch.index != null) {
    name = compact(`${beforeDate.slice(0, hoursMatch.index)} ${beforeDate.slice(hoursMatch.index + hoursMatch[0].length)}`);
  }
  name = name
    .replace(/^[#*•▪◦●■□◆◇▶►:;,.\-\s]+/, "")
    .replace(/[#*•▪◦●■□◆◇▶►:;,.\-\s]+$/, "")
    .trim();

  if (!name && !hours && !date.original && !type.value) return null;
  return {
    orden: Number(block.order || 0),
    nombre: name,
    horas: hours,
    fecha_inicio_propuesta: date.start,
    fecha_fin_propuesta: date.end,
    fecha_rango_original: date.original,
    tipo: type.value,
    actividades_teoricas: [],
    actividades_practicas: [],
    impacto_esperado: "",
    vision_largo_plazo: "",
    detalle_compartido_entre_capacitaciones: true,
    origen_extraccion: "MOTOR_TABLA_TEXTUAL"
  };
}

function parseInlineRows(section) {
  const source = compact(section);
  if (!source) return [];
  const typePattern = TRAINING_TYPES.join("|");
  const expression = new RegExp(
    `(?:^|\\s)(\\d{1,2})\\s+(.+?)\\s+(\\d{1,4})\\s+(Desde\\s+.+?\\s+(?:hasta|al)\\s+.+?)\\s+(${typePattern})(?=\\s+\\d{1,2}\\s+|$)`,
    "gi"
  );
  const output = [];
  let match;
  while ((match = expression.exec(source)) !== null) {
    const date = findDateRange(match[4]);
    output.push({
      orden: Number(match[1]),
      nombre: compact(match[2]),
      horas: Number(match[3]),
      fecha_inicio_propuesta: date.start,
      fecha_fin_propuesta: date.end,
      fecha_rango_original: date.original,
      tipo: match[5],
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: "",
      detalle_compartido_entre_capacitaciones: true,
      origen_extraccion: "MOTOR_TABLA_TEXTUAL_INLINE"
    });
  }
  return output;
}

function rowQuality(row) {
  return [
    compact(row?.nombre),
    Number(row?.horas || 0) > 0,
    compact(row?.fecha_inicio_propuesta),
    compact(row?.fecha_fin_propuesta),
    compact(row?.tipo)
  ].filter(Boolean).length;
}

function runTextTableEngine(text) {
  const section = tableSection(text);
  if (!section) return { rows: [], rowCount: 0, section: "", confidence: 0 };
  const blockRows = collectRowBlocks(section).map(parseRow).filter(Boolean);
  const inlineRows = parseInlineRows(section);
  const candidates = [blockRows, inlineRows]
    .filter((rows) => rows.length)
    .sort((left, right) => {
      const leftScore = left.reduce((sum, row) => sum + rowQuality(row), 0) + left.length * 10;
      const rightScore = right.reduce((sum, row) => sum + rowQuality(row), 0) + right.length * 10;
      return rightScore - leftScore;
    });
  const rows = (candidates[0] || []).map((row, index) => ({ ...row, orden: index + 1 }));
  const completeCells = rows.reduce((sum, row) => sum + rowQuality(row), 0);
  const confidence = rows.length ? Math.round((completeCells / (rows.length * 5)) * 100) : 0;
  return {
    rows,
    rowCount: rows.length,
    section,
    confidence,
    enginesCompared: candidates.length
  };
}

module.exports = {
  TRAINING_TYPES,
  clean,
  normalize,
  tableSection,
  collectRowBlocks,
  findDateRange,
  parseRow,
  rowQuality,
  runTextTableEngine
};