"use strict";

const path = require("path");
const crypto = require("crypto");

const MONTHS = Object.freeze({
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
});

const SUPPORT_FIELDS = Object.freeze([
  {
    field: "financiamiento_total",
    label: "Financiamiento total del costo del curso",
    pattern: /financiamiento\s+total\s+del\s+costo\s+del\s+curso/i
  },
  {
    field: "financiamiento_parcial",
    label: "Financiamiento parcial del costo del curso",
    pattern: /financiamiento\s+parcial\s+del\s+costo\s+del\s+curso/i
  },
  {
    field: "anticipo_sueldo_honorarios",
    label: "Anticipo de sueldo u honorarios",
    pattern: /anticipo\s+de\s+sueldos?\s*\/\s*honorarios/i
  },
  {
    field: "cambio_modalidad_trabajo",
    label: "Cambio temporal de modalidad de trabajo",
    pattern: /cambio\s+temporal\s+en\s+modalidad\s+de\s+trabajo/i
  },
  {
    field: "licencia_remunerada",
    label: "Licencia con remuneración",
    pattern: /licencia\s+con\s+remuneraci[oó]n/i
  },
  {
    field: "licencia_no_remunerada",
    label: "Licencia sin remuneración",
    pattern: /licencia\s+sin\s+remuneraci[oó]n/i
  },
  {
    field: "ajuste_horario_laboral",
    label: "Ajuste de horario laboral",
    pattern: /ajuste\s+de\s+horario\s+laboral/i
  }
]);

function cleanText(value) {
  return String(value || "")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compact(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function smartCase(value) {
  const clean = compact(value).replace(/^[:\-–—]+\s*/, "");
  if (!clean) return "";
  const letters = clean.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return clean;
  const lower = new Set(["de", "del", "la", "las", "los", "y", "e", "en"]);
  return clean.toLowerCase().split(" ").map((word, index) => {
    if (index > 0 && lower.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function pad2(value) {
  return String(Number(value || 0)).padStart(2, "0");
}

function validDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { year: y, month: m, day: d };
}

function dateIso(parts) {
  return parts ? `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` : "";
}

function extractAgreementCode(text, fallbackText = "") {
  const source = compact(`${text || ""} ${fallbackText || ""}`)
    .replace(/[￾�]/g, "-")
    .replace(/PRO\s*[- ]?\s*134/gi, "PRO-134")
    .replace(/RGI\s*2/gi, "RGI2");
  const strict = source.match(/\b(UGPA|CGC)\s*[- ]?\s*RGI2\s*[- ]?\s*(\d{1,4})\s*[- ]?\s*PRO-134\s*[- ]?\s*(20\d{2})\s*[- ]?\s*(1[0-2]|0?[1-9])(?=\D|$)/i);
  if (strict) {
    return `${strict[1].toUpperCase()}-RGI2-${String(Number(strict[2])).padStart(2, "0")}-PRO-134-${strict[3]}-${pad2(strict[4])}`;
  }
  const loose = source.match(/\b(UGPA|CGC).{0,10}RGI2.{0,10}(\d{1,4}).{0,14}PRO.{0,6}134.{0,10}(20\d{2}).{0,6}(1[0-2]|0?[1-9])(?=\D|$)/i);
  if (loose) {
    return `${loose[1].toUpperCase()}-RGI2-${String(Number(loose[2])).padStart(2, "0")}-PRO-134-${loose[3]}-${pad2(loose[4])}`;
  }
  return "";
}

function extractPeriod(code) {
  const match = String(code || "").match(/(20\d{2})-(1[0-2]|0[1-9])$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function parseSpanishDate(text) {
  const source = compact(text);
  const patterns = [
    /en\s+la\s+ciudad\s+de\s+quito,?\s+(?:a\s+los|desde\s+el)\s+(\d{1,2})\s+(?:d[ií]as?\s+del\s+mes\s+de|de)\s+([a-záéíóúñ]+|\d{1,2})\s+(?:de\s+)?(20\d{2})/i,
    /(?:a\s+los|desde\s+el)\s+(\d{1,2})\s+(?:d[ií]as?\s+del\s+mes\s+de|de)\s+([a-záéíóúñ]+|\d{1,2})\s+(?:de\s+)?(20\d{2})/i,
    /\b(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/
  ];

  for (let index = 0; index < patterns.length; index += 1) {
    const match = source.match(patterns[index]);
    if (!match) continue;
    const day = Number(match[1]);
    let month = Number(match[2]);
    if (!Number.isFinite(month) || month < 1 || month > 12) month = MONTHS[normalize(match[2])] || 0;
    const parts = validDateParts(match[3], month, day);
    if (parts) {
      return {
        iso: dateIso(parts),
        original: compact(match[0])
      };
    }
  }
  return { iso: "", original: "" };
}

function extractVersion(text) {
  const match = compact(text).match(/versi[oó]n\s*[:：]?\s*([0-9]+(?:\.[0-9]+)*)/i);
  return match ? match[1] : "";
}

function valueFromLabel(lines, labelPattern, stopPatterns = []) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(labelPattern);
    if (!match) continue;
    const direct = compact(line.slice(match.index + match[0].length).replace(/^\s*[:：-]\s*/, ""));
    if (direct) return direct;
    const values = [];
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
      const next = lines[cursor].trim();
      if (!next) continue;
      if (stopPatterns.some((pattern) => pattern.test(next))) break;
      values.push(next);
      if (values.length >= 2) break;
    }
    if (values.length) return compact(values.join(" "));
  }
  return "";
}

function extractTeacherName(text) {
  const source = cleanText(text);
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const cover = valueFromLabel(lines, /^docente\s*[:：]?/i, [/^carrera\s*[:：]?/i, /^capacitaci[oó]n\s*[:：]?/i]);
  if (cover && !/acuerdo|institucional/i.test(cover)) return smartCase(cover);
  const clause = compact(source).match(/(?:se[nñ]or\(a\)|se[nñ]or|colaborador(?:a)?)\s+(.+?),\s+con\s+n[uú]mero\s+de\s+c[eé]dula/i);
  return clause ? smartCase(clause[1]) : "";
}

function extractCareer(text, teacherName = "") {
  const source = cleanText(text);
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const labeled = valueFromLabel(lines, /^carrera\s*[:：]?/i, [/^capacitaci[oó]n\s*[:：]?/i, /^elaborado/i, /^firma/i]);
  if (labeled) return smartCase(labeled);

  const normalizedTeacher = normalize(teacherName);
  for (let index = 0; index < lines.length; index += 1) {
    if (!normalizedTeacher || normalize(lines[index]).includes(normalizedTeacher)) {
      for (let cursor = index + 1; cursor < Math.min(lines.length, index + 4); cursor += 1) {
        const candidate = lines[cursor];
        if (/capacitaci[oó]n/i.test(candidate)) break;
        if (!/docente|acuerdo|institucional/i.test(candidate) && candidate.length >= 4) return smartCase(candidate);
      }
    }
  }
  return "";
}

function extractTrainingName(text) {
  const source = cleanText(text);
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const cover = valueFromLabel(lines, /^capacitaci[oó]n\s*[:：]?/i, [/^elaborado/i, /^firma/i, /^unidad/i]);
  if (cover) return smartCase(cover.replace(/[.]+$/, ""));
  const clause = compact(source).match(/participaci[oó]n\s+de\s+(?:el|la)\s+colaborador(?:a)?\s+en\s+la\s+capacitaci[oó]n\s+(.+?),\s+con\s+el\s+objetivo/i);
  return clause ? smartCase(clause[1].replace(/[.]+$/, "")) : "";
}

function extractCedula(text) {
  const match = compact(text).match(/(?:n[uú]mero\s+de\s+c[eé]dula|c[eé]dula)\s*[:：]?\s*(\d{10,13})/i);
  return match ? match[1] : "";
}

function extractCargo(text) {
  const source = compact(text);
  const linked = source.match(/se\s+encuentra\s+vinculad[oa]\s*\(a\)?\s+como\s+([^.,;]+?)\s+en\s+el\s+ITSQMET/i)
    || source.match(/se\s+encuentra\s+vinculad[oa]\s+como\s+([^.,;]+?)\s+en\s+el\s+ITSQMET/i);
  if (linked) return smartCase(linked[1]);
  const cover = source.match(/cargo\s*[:：]\s*(docente|profesor(?:a)?|coordinador(?:a)?[^|,;]*)/i);
  return cover ? smartCase(cover[1]) : "Docente";
}

function lineSegments(text) {
  return cleanText(text).split("\n").map((line) => line.trim()).filter(Boolean);
}

function markedInSegment(segment) {
  return /(?:^|\s)(?:x|X|✓|✔|☒|■|si|sí)(?:\s|$)/.test(segment)
    || /marcar\s*[:：]?\s*(?:x|X|✓|✔|☒|■)/i.test(segment);
}

function extractSupport(text) {
  const lines = lineSegments(text);
  const support = {
    financiamiento_total: false,
    financiamiento_parcial: false,
    porcentaje_financiado: "",
    anticipo_sueldo_honorarios: false,
    cambio_modalidad_trabajo: false,
    licencia_remunerada: false,
    licencia_no_remunerada: false,
    ajuste_horario_laboral: false
  };

  SUPPORT_FIELDS.forEach((definition, definitionIndex) => {
    for (let index = 0; index < lines.length; index += 1) {
      if (!definition.pattern.test(lines[index])) continue;
      let segment = lines[index];
      for (let cursor = index + 1; cursor < Math.min(lines.length, index + 3); cursor += 1) {
        if (SUPPORT_FIELDS.some((next, nextIndex) => nextIndex !== definitionIndex && next.pattern.test(lines[cursor]))) break;
        if (/compromisos/i.test(lines[cursor])) break;
        segment += ` ${lines[cursor]}`;
      }
      support[definition.field] = markedInSegment(segment);
      if (definition.field === "financiamiento_parcial") {
        const percentage = segment.match(/(?:porcentaje\s*[:：]?\s*|\(\s*indicar\s+porcentaje\s*[:：]?\s*)(\d{1,3}(?:[.,]\d+)?)\s*%/i)
          || segment.match(/\b(\d{1,3}(?:[.,]\d+)?)\s*%/);
        if (percentage) support.porcentaje_financiado = percentage[1].replace(",", ".");
      }
      break;
    }
  });

  if (support.porcentaje_financiado) support.financiamiento_parcial = true;
  if (!support.financiamiento_parcial) support.porcentaje_financiado = "";
  return support;
}

function inferAgreementState(text, metadata = {}) {
  const method = String(metadata.method || "").toUpperCase();
  const source = normalize(text);
  const explicitSignedEvidence = [
    "firmado electronicamente",
    "firma electronica",
    "documento firmado",
    "suscrito digitalmente",
    "firmado digitalmente"
  ].some((marker) => source.includes(marker));
  if (explicitSignedEvidence) return "FIRMADO";
  if (["OCR", "MIXTO"].includes(method)) return "REVISAR";
  return "PENDIENTE_FIRMA";
}

function agreementSignalScore(text) {
  const source = normalize(text);
  let score = 0;
  if (source.includes("acuerdo de patrocinio institucional")) score += 3;
  if (source.includes("pro 134")) score += 2;
  if (source.includes("el colaborador")) score += 1;
  if (source.includes("apoyo institucional")) score += 1;
  if (source.includes("financiamiento total del costo del curso")) score += 1;
  if (source.includes("compromisos del colaborador") || source.includes("compromisos")) score += 1;
  return score;
}

function supportCount(support) {
  return SUPPORT_FIELDS.reduce((sum, definition) => sum + (support[definition.field] ? 1 : 0), 0);
}

function evaluateAgreement(record, options = {}) {
  const output = JSON.parse(JSON.stringify(record || {}));
  output.acuerdo = output.acuerdo || {};
  output.docente = output.docente || {};
  output.capacitacion = output.capacitacion || {};
  output.patrocinio = output.patrocinio || {};
  const missing = [];

  [
    ["Código único del acuerdo", output.acuerdo.codigo],
    ["Fecha de suscripción", output.acuerdo.fecha_suscripcion],
    ["Periodo", output.acuerdo.periodo],
    ["Estado del acuerdo", output.acuerdo.estado_acuerdo],
    ["Cédula del docente", output.docente.cedula],
    ["Nombre completo", output.docente.nombre],
    ["Carrera", output.docente.carrera],
    ["Cargo", output.docente.cargo],
    ["Nombre de la capacitación", output.capacitacion.nombre]
  ].forEach(([label, value]) => { if (!compact(value)) missing.push(label); });

  if (!compact(output.capacitacion.id_plan)) missing.push("ID de la capacitación del plan");
  if (!supportCount(output.patrocinio)) missing.push("Apoyo institucional seleccionado");

  if (output.patrocinio.financiamiento_total && output.patrocinio.financiamiento_parcial) {
    missing.push("Selecciona únicamente financiamiento total o parcial");
  }

  if (output.patrocinio.financiamiento_parcial) {
    const rawPercentage = compact(output.patrocinio.porcentaje_financiado).replace(",", ".");
    const percentage = Number(rawPercentage);
    if (!rawPercentage) missing.push("Porcentaje financiado");
    else if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      missing.push("Porcentaje financiado válido entre 1 y 100");
    }
  }

  output.campos_faltantes = [...new Set(missing)];
  const total = 11;
  output.confianza = Math.max(0, Math.min(100, Math.round(((total - Math.min(total, missing.length)) / total) * 100)));
  const isAgreement = options.isAgreement !== false;
  const possibleAgreement = Boolean(options.possibleAgreement);
  if (!isAgreement && !possibleAgreement) output.estado = "NO_ES_ACUERDO";
  else output.estado = missing.length ? "REVISAR" : "COMPLETO";
  return output;
}

function parseAgreementText(text, metadata = {}) {
  const source = cleanText(text);
  const code = extractAgreementCode(source, metadata.fileName || "");
  const date = parseSpanishDate(source);
  const teacherName = extractTeacherName(source);
  const career = extractCareer(source, teacherName);
  const trainingName = extractTrainingName(source);
  const support = extractSupport(source);
  const score = agreementSignalScore(source);
  const possibleAgreement = score >= 3 || Boolean(teacherName && trainingName && supportCount(support));
  const isAgreement = score >= 5 || Boolean(code && teacherName && trainingName);
  const warnings = Array.isArray(metadata.warnings) ? [...metadata.warnings] : [];
  const inferredState = inferAgreementState(source, metadata);
  if (inferredState === "REVISAR") {
    warnings.push("El PDF es una copia escaneada; verifica visualmente las firmas antes de marcarlo como Firmado.");
  }
  if (possibleAgreement && !isAgreement) warnings.push("El contenido parece un acuerdo, pero requiere confirmación manual.");

  const record = {
    id: crypto.randomUUID(),
    archivo: {
      nombre: metadata.fileName || path.basename(metadata.filePath || "acuerdo.pdf"),
      ruta: metadata.filePath || "",
      hash: metadata.hash || "",
      tamano: Number(metadata.size || 0),
      paginas: Number(metadata.pages || 0),
      metodo_lectura: metadata.method || "",
      fecha_procesamiento: new Date().toISOString()
    },
    acuerdo: {
      codigo: code,
      fecha_suscripcion: date.iso,
      fecha_suscripcion_original: date.original,
      periodo: extractPeriod(code),
      version_plantilla: extractVersion(source),
      estado_acuerdo: inferredState,
      archivo_pdf_final: metadata.filePath || ""
    },
    docente: {
      cedula: extractCedula(source),
      nombre: teacherName,
      carrera: career,
      cargo: extractCargo(source)
    },
    capacitacion: {
      id_plan: "",
      plan_id: "",
      nombre: trainingName,
      vinculada: false
    },
    patrocinio: support,
    estado: "REVISAR",
    confianza: 0,
    campos_faltantes: [],
    advertencias: warnings,
    deteccion: {
      puntaje_acuerdo: score,
      confirmado_como_acuerdo: isAgreement,
      posible_acuerdo: possibleAgreement
    },
    correccion_manual: false,
    fecha_correccion: ""
  };

  return evaluateAgreement(record, { isAgreement, possibleAgreement });
}

module.exports = {
  MONTHS,
  SUPPORT_FIELDS,
  cleanText,
  normalize,
  extractAgreementCode,
  extractPeriod,
  parseSpanishDate,
  extractVersion,
  extractSupport,
  agreementSignalScore,
  evaluateAgreement,
  parseAgreementText
};
