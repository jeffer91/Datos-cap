/* =========================================================
Nombre completo: certificates.parser.js
Ruta o ubicación: /src/document-types/informe-final-capacitacion/certificates.parser.js
Función o funciones:
- Interpretar la tabla individual de certificados.
- Extraer el resumen de inscritos, aprobados, participantes, facilitadores, desertores y reprobados.
- Inferir una categoría únicamente cuando los totales permiten hacerlo sin ambigüedad.
========================================================= */
"use strict";

const {
  normalizeLineBreaks,
  normalizeSpaces,
  normalizeForSearch,
  splitCleanLines,
  cleanValue
} = require("../../extractor/normalizer");
const { createRowId } = require("../../utils/ids");

const CATEGORY_FIELDS = Object.freeze({
  aprobacion: "certificado_aprobacion",
  participacion: "certificado_participacion",
  facilitador: "certificado_facilitador",
  reprobo: "reprobo_curso",
  deserto: "deserto_curso"
});

function extractSection(text, startPattern, endPatterns) {
  const source = normalizeLineBreaks(text);
  const start = startPattern.exec(source);
  if (!start) return "";
  const from = start.index + start[0].length;
  const remaining = source.slice(from);
  let end = remaining.length;
  for (const pattern of endPatterns) {
    const match = pattern.exec(remaining);
    if (match && match.index < end) end = match.index;
  }
  return remaining.slice(0, end).trim();
}

function extractCertificatesSection(text) {
  return extractSection(
    text,
    /CERTIFICADOS?\s+A\s+ENTREGAR\s*:?/i,
    [
      /\n\s*\d+\.?\s*RES[ÚU]MEN\s+ENTREGA\s+DE\s+CERTIFICADOS/i,
      /\n\s*\d+\.?\s*CONCLUSIONES/i,
      /\n\s*\d+\.?\s*ANEXOS?/i
    ]
  );
}

function extractSummarySection(text) {
  return extractSection(
    text,
    /RES[ÚU]MEN\s+ENTREGA\s+DE\s+CERTIFICADOS\s*:?/i,
    [
      /\n\s*\d+\.?\s*CONCLUSIONES/i,
      /\n\s*\d+\.?\s*RECOMENDACIONES/i,
      /\n\s*\d+\.?\s*ANEXOS?/i,
      /\n\s*ELABORADO\s+POR/i
    ]
  );
}

function numberAfterLabel(text, labelPattern) {
  const compact = normalizeSpaces(text);
  const match = new RegExp(`${labelPattern}[\\s\\S]{0,180}?(\\d{1,4})(?=\\s|$)`, "i").exec(compact);
  return match ? Number(match[1]) : 0;
}

function parseCertificateSummary(text, context) {
  const section = extractSummarySection(text);
  if (!section) return {
    id: createRowId("resumen-certificados", context.id_documento, 0, "sin-resumen"),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    total_inscritos: 0,
    total_certificado_aprobacion: 0,
    total_certificado_participacion: 0,
    total_facilitadores: 0,
    total_desertores: 0,
    total_reprobados: 0,
    requiere_revision: "SI",
    observacion_extraccion: "No se localizó el resumen de certificados."
  };

  const values = {
    total_inscritos: numberAfterLabel(section, "TOTAL\\s+(?:DE\\s+)?INSCRITOS"),
    total_certificado_aprobacion: numberAfterLabel(section, "TOTAL\\s+DE\\s+PERSONAS[\\s\\S]{0,80}?CERTIFICADO\\s+DE\\s+APROBACI[ÓO]N"),
    total_certificado_participacion: numberAfterLabel(section, "TOTAL\\s+DE\\s+PERSONAS[\\s\\S]{0,80}?CERTIFICADO\\s+DE\\s+PARTICIPACI[ÓO]N"),
    total_facilitadores: numberAfterLabel(section, "TOTAL\\s+(?:DOCENTE/S|DE\\s+DOCENTES?|FACILITADOR/ES|FACILITADORES?)"),
    total_desertores: numberAfterLabel(section, "TOTAL\\s+DE\\s+PERSONAS[\\s\\S]{0,60}?DESERTARON"),
    total_reprobados: numberAfterLabel(section, "TOTAL\\s+DE\\s+PERSONAS[\\s\\S]{0,60}?REPROBARON")
  };

  if (!Object.values(values).some((value) => value > 0)) {
    const numbers = (normalizeSpaces(section).match(/\b\d{1,4}\b/g) || []).map(Number);
    if (numbers.length >= 6) {
      [
        values.total_inscritos,
        values.total_certificado_aprobacion,
        values.total_certificado_participacion,
        values.total_facilitadores,
        values.total_desertores,
        values.total_reprobados
      ] = numbers.slice(-6);
    }
  }

  const warnings = [];
  if (!values.total_inscritos) warnings.push("No se detectó el total de inscritos.");
  return {
    id: createRowId("resumen-certificados", context.id_documento, 0, JSON.stringify(values)),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    ...values,
    texto_original: cleanValue(section),
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function detectExplicitCategory(text) {
  const search = normalizeForSearch(text);
  if (/aprobacion.{0,20}(?:x|marcado)|(?:x|marcado).{0,20}aprobacion/.test(search)) return "aprobacion";
  if (/participacion.{0,20}(?:x|marcado)|(?:x|marcado).{0,20}participacion/.test(search)) return "participacion";
  if (/facilitador.{0,20}(?:x|marcado)|(?:x|marcado).{0,20}facilitador/.test(search)) return "facilitador";
  if (/reprobo.{0,20}(?:x|marcado)|(?:x|marcado).{0,20}reprobo/.test(search)) return "reprobo";
  if (/deserto.{0,20}(?:x|marcado)|(?:x|marcado).{0,20}deserto/.test(search)) return "deserto";
  return "";
}

function inferSingleCategory(summary, markedCount) {
  const totals = {
    aprobacion: Number(summary.total_certificado_aprobacion || 0),
    participacion: Number(summary.total_certificado_participacion || 0),
    facilitador: Number(summary.total_facilitadores || 0),
    reprobo: Number(summary.total_reprobados || 0),
    deserto: Number(summary.total_desertores || 0)
  };
  const positive = Object.entries(totals).filter(([, value]) => value > 0);
  if (positive.length === 1 && positive[0][1] === markedCount) return positive[0][0];
  return "";
}

function participantByName(participants, name) {
  const key = normalizeForSearch(name);
  if (!key) return null;
  return (participants || []).find((participant) => {
    const participantKey = normalizeForSearch(participant.nombres_apellidos);
    return participantKey === key || participantKey.includes(key) || key.includes(participantKey);
  }) || null;
}

function parseCertificateRows(text, context, participants, summary) {
  const section = extractCertificatesSection(text);
  if (!section) return [];
  const lines = splitCleanLines(section).filter((line) => {
    const search = normalizeForSearch(line);
    return search &&
      !search.startsWith("nombres y apellidos") &&
      !search.startsWith("certificado de") &&
      !search.startsWith("reprobo") &&
      !search.startsWith("deserto") &&
      !search.startsWith("pagina ");
  });

  const segments = [];
  let current = null;
  for (const line of lines) {
    if (/^\s*\d{1,3}\s+/.test(line)) {
      if (current) segments.push(current);
      current = line;
    } else if (current) {
      current += ` ${line}`;
    }
  }
  if (current) segments.push(current);

  const markedCount = segments.filter((segment) => /(?:^|\s)(?:x|×|☒|■|✓|✔)(?:\s|$)/i.test(segment)).length;
  const inferredCategory = inferSingleCategory(summary, markedCount);

  return segments.map((segment, index) => {
    const numberMatch = segment.match(/^\s*(\d{1,3})\s+/);
    const numero = numberMatch ? Number(numberMatch[1]) : index + 1;
    const withoutNumber = cleanValue(segment.replace(/^\s*\d{1,3}\s+/, ""));
    const hasMark = /(?:^|\s)(?:x|×|☒|■|✓|✔)(?:\s|$)/i.test(withoutNumber);
    const name = cleanValue(withoutNumber.replace(/(?:^|\s)(?:x|×|☒|■|✓|✔)(?:\s|$)/gi, " "));
    const explicitCategory = detectExplicitCategory(withoutNumber);
    const category = explicitCategory || (hasMark ? inferredCategory : "");
    const participant = participantByName(participants, name);
    const warnings = [];
    if (hasMark && !category) warnings.push("Se detectó una marca, pero su columna requiere revisión visual.");
    if (!participant) warnings.push("No se pudo vincular automáticamente con la matriz de participantes.");

    const flags = Object.fromEntries(Object.values(CATEGORY_FIELDS).map((field) => [field, "NO"]));
    if (category && CATEGORY_FIELDS[category]) flags[CATEGORY_FIELDS[category]] = "SI";

    return {
      id: createRowId("certificado-informe", context.id_documento, index, `${numero}|${name}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      numero,
      participante: name,
      cedula: participant?.cedula || "",
      ...flags,
      marca_detectada: hasMark ? "SI" : "NO",
      categoria_inferida: category,
      fila_original: cleanValue(segment),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    };
  });
}

function parseCertificates(text, context, participants) {
  const summary = parseCertificateSummary(text, context);
  return {
    rows: parseCertificateRows(text, context, participants, summary),
    summary
  };
}

module.exports = {
  CATEGORY_FIELDS,
  extractCertificatesSection,
  extractSummarySection,
  parseCertificateSummary,
  parseCertificateRows,
  parseCertificates
};
