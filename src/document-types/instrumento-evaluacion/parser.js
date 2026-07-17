"use strict";

const path = require("path");
const {
  normalizeLineBreaks,
  normalizeSpaces,
  normalizeForSearch,
  splitCleanLines,
  cleanValue,
  firstMatch,
  extractBetween,
  uniqueValues
} = require("../../extractor/normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../../utils/ids");
const { parseFlexibleCode, normalizeDate } = require("../seguimiento-capacitacion.factory");

const TABLE_NAMES = Object.freeze({
  archivos: "archivos_instrumento_evaluacion",
  datos: "datos_generales_instrumento",
  participantes: "participantes_instrumento_evaluacion",
  recursos_metodologia: "recursos_metodologia_instrumento_evaluacion",
  resultados_cuantitativos: "resultados_cuantitativos_instrumento_evaluacion",
  likert_participantes: "likert_participantes_instrumento_evaluacion",
  objetivos: "cumplimiento_objetivos_instrumento_evaluacion",
  likert_facilitador: "likert_facilitador_instrumento_evaluacion",
  compromiso_motivacion: "compromiso_motivacion_instrumento_evaluacion",
  transferencia: "transferencia_aprendizaje_instrumento_evaluacion",
  impacto: "impacto_organizacional_instrumento_evaluacion",
  mejoras: "planes_mejora_instrumento_evaluacion",
  items: "items_instrumento_evaluacion",
  resultados: "resultados_instrumento_evaluacion",
  responsables: "responsables_instrumento_evaluacion",
  anexos: "anexos_instrumento_evaluacion",
  ocr: "ocr_paginas_instrumento_evaluacion"
});

const DEFINITION = Object.freeze({
  id: "instrumento-evaluacion",
  label: "Instrumento de Evaluación",
  shortLabel: "Instrumentos de Evaluación",
  description: "Procesa instrumentos PRO-135 reales y separa participantes, resultados, escalas, objetivos, transferencia, impacto y mejora en tablas independientes.",
  allowMultiple: true,
  fileNameHints: ["INSTRUMENTO", "EVALUACION", "PRO-135"],
  reportPrefix: "reporte_instrumentos_evaluacion",
  tables: Object.entries(TABLE_NAMES).map(([key, name], index) => ({
    key,
    name,
    sheet: `${String(index + 1).padStart(2, "0")}_${key}`.slice(0, 31)
  }))
});

const MONTH_PATTERN = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";
const NAME_TOKEN = "A-Za-zÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòù.'’-";
const LIKERT_OPTIONS = Object.freeze([
  "MUY_EN_DESACUERDO",
  "EN_DESACUERDO",
  "NEUTRAL",
  "DE_ACUERDO",
  "MUY_DE_ACUERDO"
]);

function yesNo(value) { return value ? "SI" : "NO"; }
function text(value) { return String(value == null ? "" : value); }
function normalized(value) { return normalizeForSearch(text(value)); }
function compact(value) {
  return normalizeSpaces(normalizeLineBreaks(text(value)).replace(/[￾\uFFFE]/g, "-")).replace(/\s*[-–—]\s*/g, "-");
}
function rowBase(prefix, context, index, seed) {
  return {
    id: createRowId(prefix, context.id_documento, index, seed),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo
  };
}
function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2)) : "";
}
function minPositive(values, fallback) {
  const valid = values.filter((value) => Number.isInteger(value) && value >= 0);
  return valid.length ? Math.min(...valid) : fallback;
}
function regexIndex(source, pattern, from = 0) {
  const match = new RegExp(pattern, "i").exec(source.slice(from));
  return match ? from + match.index : -1;
}
function sliceByPatterns(source, starts, ends) {
  const value = normalizeLineBreaks(source);
  const startIndexes = (Array.isArray(starts) ? starts : [starts]).map((pattern) => regexIndex(value, pattern)).filter((index) => index >= 0);
  if (!startIndexes.length) return "";
  const start = Math.min(...startIndexes);
  const afterStart = value.indexOf("\n", start);
  const contentStart = afterStart >= 0 ? afterStart + 1 : start;
  const endIndexes = (Array.isArray(ends) ? ends : [ends]).map((pattern) => regexIndex(value, pattern, contentStart)).filter((index) => index >= 0);
  return value.slice(contentStart, minPositive(endIndexes, value.length));
}
function captureBetweenCompact(source, startPattern, endPatterns) {
  const value = compact(source);
  const startMatch = new RegExp(startPattern, "i").exec(value);
  if (!startMatch) return "";
  const start = startMatch.index + startMatch[0].length;
  const end = minPositive((endPatterns || []).map((pattern) => regexIndex(value, pattern, start)).filter((index) => index >= 0), value.length);
  return cleanValue(value.slice(start, end));
}
function cleanField(value) {
  return cleanValue(text(value)
    .replace(/^[\s:;•▪#.-]+/, "")
    .replace(/\bP[ÁA]GINA\s+\d+(?:\s+DE\s+\d+)?\b.*$/i, "")
    .replace(/\s+/g, " "));
}
function parseDateFromText(source) {
  const candidates = [
    firstMatch(source, [new RegExp(`(?:fecha\\s+de\\s+elaboraci[oó]n|fecha\\s+de\\s+evaluaci[oó]n)\\s*:?\\s*([0-9]{1,2}(?:\\s+de)?\\s+(?:${MONTH_PATTERN})(?:\\s+de)?\\s+[0-9]{4})`, "i")]),
    firstMatch(source, [/(?:fecha\s+de\s+elaboraci[oó]n|fecha\s+de\s+evaluaci[oó]n)\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i]),
    firstMatch(source, [new RegExp(`\\b([0-9]{1,2}[- ](?:${MONTH_PATTERN})[- ][0-9]{4})\\b`, "i")])
  ].filter(Boolean);
  const raw = cleanField(candidates[0] || "");
  return { raw, iso: normalizeDate(raw) };
}
function extractHeaderTitle(source) {
  return cleanField(firstMatch(source, [
    /instrumento\s+de\s+evaluaci[oó]n\s+de\s+la\s+capacitaci[oó]n\s*:\s*([^\n]+)/i,
    /instrumento\s+de\s+evaluaci[oó]n\s+de\s+la\s+capacitaci[oó]n\s*([^\n]+)/i
  ]));
}
function extractGeneralFields(source) {
  const raw = normalizeLineBreaks(source);
  const general = sliceByPatterns(raw, ["(?:^|\\n)\\s*1[.)]?\\s*DATOS\\s+GENERALES"], ["(?:^|\\n)\\s*2[.)]?\\s*MATRIZ"]);
  const body = general || raw;
  const course = captureBetweenCompact(body,
    "NOMBRE\\s+DEL\\s+CURSO\\s*:?",
    ["PER[IÍ]ODO\\s+DE\\s+LA\\s+CAPACITACI[OÓ]N", "NOMBRE\\s+DEL[/\\s]*LOS\\s+FACILITADOR"]);
  const period = captureBetweenCompact(body,
    "PER[IÍ]ODO\\s+DE\\s+LA\\s+CAPACITACI[OÓ]N\\s*:?",
    ["NOMBRE\\s+DEL[/\\s]*LOS\\s+FACILITADOR", "FECHA\\s+DE\\s+ELABORACI[OÓ]N"]);
  const facilitator = captureBetweenCompact(body,
    "NOMBRE\\s+DEL[/\\s]*LOS\\s+FACILITADOR(?:\\(ES\\)|ES)?\\s*:?",
    ["FECHA\\s+DE\\s+ELABORACI[OÓ]N", "2[.)]?\\s*MATRIZ"]);
  const headerTitle = extractHeaderTitle(raw);
  const directed = cleanField(firstMatch(`${headerTitle}\n${raw.slice(0, 5000)}`, [
    /dirigido\s+a\s+(todas\s+las\s+carreras)/i,
    /dirigido\s+a\s+la\s+carrera\s+de\s+([^\n]+)/i,
    /dirigido\s+a\s+([^\n]+)/i
  ]));
  const career = /todas\s+las\s+carreras/i.test(directed) ? "TODAS LAS CARRERAS" : directed.replace(/^la\s+carrera\s+de\s+/i, "");
  return {
    nombre_capacitacion: cleanField(course || headerTitle.replace(/,?\s*dirigido\s+a.*$/i, "")),
    titulo_documento: headerTitle,
    periodo_capacitacion: cleanField(period),
    facilitador: cleanField(facilitator),
    publico_dirigido: directed,
    carrera: cleanField(career),
    version_documento: cleanField(firstMatch(raw, [/versi[oó]n\s*:?\s*([0-9]+(?:[.,][0-9]+)?)/i]))
  };
}
function declaredPages(source) {
  const values = [...normalizeLineBreaks(source).matchAll(/p[áa]gina(?:s)?\s*:?\s*(\d+)\s+de\s+(\d+)/gi)]
    .map((match) => ({ current: Number(match[1]), total: Number(match[2]) }));
  return {
    first: values[0] || null,
    maxTotal: values.length ? Math.max(...values.map((row) => row.total)) : 0,
    inconsistent: new Set(values.map((row) => row.total)).size > 1
  };
}
function stripParticipantNoise(value) {
  return compact(value)
    .replace(/UNIDAD\s+DE\s+GESTI[OÓ]N\s+DE\s+PROCESOS\s+ACAD[ÉE]MICOS/gi, " ")
    .replace(/C[ÓO]DIGO\s*:?\s*(?:UGPA|CGC)-[^\s]+/gi, " ")
    .replace(/VERSI[OÓ]N\s*:?\s*[0-9.]+/gi, " ")
    .replace(/FECHA\s+DE\s+ELABORACI[OÓ]N\s*:?\s*[^P]{0,40}/gi, " ")
    .replace(/INSTRUMENTO\s+DE\s+EVALUACI[OÓ]N\s+DE\s+LA\s+CAPACITACI[OÓ]N\s*:?/gi, " ")
    .replace(/P[ÁA]GINA(?:S)?\s*:?\s*\d+\s+DE\s+\d+/gi, " ")
    .replace(/N[º°#]?\s*NOMBRES?\s+Y\s+APELLIDOS?/gi, " ")
    .replace(/C[ÉE]DULA\s+DE\s+IDENTIDAD/gi, " ")
    .replace(/TIENE\s+DISCAPACIDAD/gi, " ")
    .replace(/TIPO\s+DE\s+DISCAPACIDAD/gi, " ")
    .replace(/POSEE\s+CARN[ÉE]\s+DE\s+DISCAPACIDAD/gi, " ")
    .replace(/G[ÉE]NERO/gi, " ")
    .replace(/\bSI\s+NO\s+SI\s+NO\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeCedula(raw) {
  const digits = text(raw).replace(/\D/g, "");
  return {
    raw: digits,
    normalized: digits.length === 9 ? digits.padStart(10, "0") : digits,
    leadingZeroInferred: digits.length === 9
  };
}
function pageWords(pdf) {
  return (pdf.pages || []).flatMap((page) => (page.words || []).map((word) => ({
    ...word,
    pageNumber: Number(page.pageNumber || 0),
    pageWidth: Number(page.width || page.imageWidth || 0),
    pageHeight: Number(page.height || page.imageHeight || 0)
  })));
}
function participantLayout(pdf, cedulaRaw, cedulaNormalized) {
  const words = pageWords(pdf);
  const idWord = words.find((word) => {
    const digits = text(word.text).replace(/\D/g, "");
    return digits && (digits === cedulaRaw || digits === cedulaNormalized || digits.padStart(10, "0") === cedulaNormalized);
  });
  if (!idWord || !idWord.pageWidth) return null;
  const centerY = (Number(idWord.y0 || 0) + Number(idWord.y1 || 0)) / 2;
  const sameRow = words.filter((word) => word.pageNumber === idWord.pageNumber && Math.abs((((Number(word.y0 || 0) + Number(word.y1 || 0)) / 2) - centerY)) <= Math.max(18, (Number(idWord.y1 || 0) - Number(idWord.y0 || 0)) * 1.5));
  const marks = sameRow.filter((word) => /^[x×]$/i.test(text(word.text).trim())).map((word) => (((Number(word.x0 || 0) + Number(word.x1 || 0)) / 2) / idWord.pageWidth));
  let disability = "";
  let card = "";
  marks.forEach((ratio) => {
    if (ratio >= 0.50 && ratio <= 0.66) disability = ratio < 0.575 ? "SI" : "NO";
    if (ratio >= 0.73 && ratio <= 0.90) card = ratio < 0.815 ? "SI" : "NO";
  });
  return { disability, card, marks, pageNumber: idWord.pageNumber };
}
function participantRows(source, pdf, context) {
  const section = sliceByPatterns(source,
    ["(?:^|\\n)\\s*2[.)]?\\s*MATRIZ\\s+CON\\s+LOS\\s+DATOS\\s+DE\\s+LOS\\s+PARTICIPANTES"],
    ["(?:^|\\n)\\s*3[.)]?\\s*RESULTADOS\\s+DE\\s+EVALUACI[OÓ]N"]);
  const cleaned = stripParticipantNoise(section);
  const pattern = new RegExp(`(?:^|\\s)(\\d{1,3})\\s+([${NAME_TOKEN}]+(?:\\s+[${NAME_TOKEN}]+){1,9})\\s+(\\d{9,10})\\s+([\\s\\S]*?)(?=(?:\\s+\\d{1,3}\\s+[${NAME_TOKEN}])|$)`, "g");
  const rows = [];
  let match;
  while ((match = pattern.exec(cleaned)) !== null) {
    const sequence = Number(match[1]);
    const name = cleanField(match[2]);
    const id = normalizeCedula(match[3]);
    const tail = cleanField(match[4]);
    const genderMatch = tail.match(/\b(M|F|MASCULINO|FEMENINO)\b/i);
    const gender = genderMatch ? (/^F/i.test(genderMatch[1]) ? "F" : "M") : "";
    const layout = participantLayout(pdf, id.raw, id.normalized);
    const xCount = (tail.match(/[x×]/gi) || []).length;
    const disability = layout?.disability || (xCount >= 1 ? "NO" : "");
    const card = layout?.card || (xCount >= 2 ? "NO" : "");
    const ambiguous = !layout && xCount > 0;
    rows.push({
      ...rowBase("participante-instrumento", context, rows.length, `${id.normalized}|${name}`),
      numero: sequence,
      nombre_participante: name,
      nombre_docente: name,
      cedula: id.raw,
      identificacion: id.raw,
      cedula_docente: id.raw,
      cedula_normalizada: id.normalized,
      cero_inicial_inferido: yesNo(id.leadingZeroInferred),
      tiene_discapacidad: disability,
      tipo_discapacidad: disability === "NO" ? "NINGUNA" : "",
      posee_carne_discapacidad: card,
      genero: gender,
      pagina_origen: layout?.pageNumber || "",
      evidencia_texto: cleanField(`${sequence} ${name} ${id.raw} ${tail}`),
      confianza_extraccion: layout ? "ALTA" : ambiguous ? "MEDIA" : "BAJA",
      requiere_revision: yesNo(!name || !id.raw || !gender || ambiguous || id.leadingZeroInferred),
      observacion_extraccion: [
        id.leadingZeroInferred ? "La cédula tenía 9 dígitos; se conservó el valor original y se creó una versión normalizada con cero inicial." : "",
        ambiguous ? "Las marcas de discapacidad/carné se interpretaron con la plantilla PRO-135 porque el texto no conserva coordenadas." : "",
        !gender ? "No se detectó género." : ""
      ].filter(Boolean).join(" ")
    });
  }
  return rows.filter((row, index, all) => all.findIndex((candidate) => candidate.numero === row.numero && candidate.cedula_normalizada === row.cedula_normalizada) === index);
}
function parseResultValue(raw) {
  const value = cleanField(raw);
  const fraction = value.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
  if (fraction) return { resultado_texto: fraction[0], valor_numerico: Number(fraction[1].replace(",", ".")), unidad: "NOTA", escala_maxima: Number(fraction[2].replace(",", ".")) };
  const percentage = value.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percentage) return { resultado_texto: percentage[0], valor_numerico: Number(percentage[1].replace(",", ".")), unidad: "PORCENTAJE", escala_maxima: 100 };
  const number = value.match(/\b(\d+(?:[.,]\d+)?)\b/);
  if (number) return { resultado_texto: number[0], valor_numerico: Number(number[1].replace(",", ".")), unidad: "CANTIDAD", escala_maxima: "" };
  return { resultado_texto: value, valor_numerico: "", unidad: value ? "TEXTO" : "", escala_maxima: "" };
}
function captureKnownRow(section, definition, nextDefinitions) {
  const value = compact(section);
  const start = regexIndex(value, definition.pattern);
  if (start < 0) return null;
  const end = minPositive(nextDefinitions.map((row) => regexIndex(value, row.pattern, start + 1)).filter((index) => index > start), value.length);
  const segment = cleanField(value.slice(start, end));
  const afterLabel = segment.replace(new RegExp(`^.*?${definition.pattern}`, "i"), "");
  const parsed = parseResultValue(afterLabel);
  let observation = cleanField(afterLabel.replace(parsed.resultado_texto, ""));
  if (definition.indicatorPattern) observation = cleanField(observation.replace(new RegExp(definition.indicatorPattern, "i"), ""));
  return { segment, parsed, observation };
}
function parseKnownTable(section, definitions, context, prefix, dimension) {
  return definitions.map((definition, index) => {
    const captured = captureKnownRow(section, definition, definitions.slice(index + 1));
    if (!captured) return null;
    return {
      ...rowBase(prefix, context, index, definition.key),
      dimension,
      criterio: definition.label,
      indicador: definition.indicator,
      ...captured.parsed,
      observaciones: captured.observation,
      evidencia_texto: captured.segment,
      requiere_revision: yesNo(captured.parsed.valor_numerico === ""),
      observacion_extraccion: captured.parsed.valor_numerico === "" ? "No se detectó un resultado numérico inequívoco." : ""
    };
  }).filter(Boolean);
}
const RESOURCE_ROWS = Object.freeze([
  { key: "cronograma", label: "Cumplimiento del Cronograma", pattern: "CUMPLIMIENTO\\s+DEL\\s+CRONOGRAMA", indicator: "Porcentaje de sesiones realizadas según el plan", indicatorPattern: "PORCENTAJE\\s+DE\\s+SESIONES\\s+REALIZADAS\\s+SEG[ÚU]N\\s+EL\\s+PLAN" },
  { key: "participacion", label: "Participación Activa", pattern: "PARTICIPACI[OÓ]N\\s+ACTIVA", indicator: "Número de participantes activos", indicatorPattern: "N[ÚU]MERO\\s+DE\\s+PARTICIPANTES\\s+ACTIVOS" },
  { key: "recursos", label: "Uso de Recursos Tecnológicos", pattern: "USO\\s+DE\\s+RECURSOS\\s+TECNOL[OÓ]GICOS", indicator: "Porcentaje de recursos utilizados eficientemente", indicatorPattern: "PORCENTAJE\\s+DE\\s+RECURSOS\\s+UTILIZADOS\\s+EFICIENTEMENTE" },
  { key: "metodologia", label: "Aplicación de la Metodología", pattern: "APLICACI[OÓ]N\\s+DE\\s+LA\\s+METODOLOG[IÍ]A", indicator: "Número de actividades ejecutadas con la metodología planeada", indicatorPattern: "N[ÚU]MERO\\s+DE\\s+ACTIVIDADES\\s+EJECUTADAS\\s+CON\\s+LA\\s+METODOLOG[IÍ]A\\s+PLANEADA" },
  { key: "adaptabilidad", label: "Adaptabilidad del Facilitador", pattern: "ADAPTABILIDAD\\s+DEL\\s+FACILITADOR", indicator: "Número de ajustes realizados por el facilitador", indicatorPattern: "N[ÚU]MERO\\s+DE\\s+AJUSTES\\s+REALIZADOS\\s+POR\\s+EL\\s+FACILITADOR" }
]);
const QUANTITATIVE_ROWS = Object.freeze([
  { key: "aprendizaje", label: "Evaluación del Aprendizaje", pattern: "EVALUACI[OÓ]N\\s+DEL\\s+APRENDIZAJE", indicator: "Promedio de calificaciones obtenidas", indicatorPattern: "PROMEDIO\\s+DE\\s+CALIFICACIONES\\s+OBTENIDAS" },
  { key: "satisfaccion", label: "Satisfacción de Participantes", pattern: "SATISFACCI[OÓ]N\\s+DE\\s+PARTICIPANTES", indicator: "Número de participantes satisfechos", indicatorPattern: "N[ÚU]MERO\\s+DE\\s+PARTICIPANTES\\s+SATISFECHOS" },
  { key: "aprobacion", label: "Resultados Finales", pattern: "RESULTADOS\\s+FINALES", indicator: "Tasa de aprobación", indicatorPattern: "TASA\\s+DE\\s+APROBACI[OÓ]N" },
  { key: "aplicabilidad", label: "Aplicabilidad de Conocimientos", pattern: "APLICABILIDAD\\s+DE\\s+CONOCIMIENTOS", indicator: "Porcentaje de participantes que aplican lo aprendido", indicatorPattern: "PORCENTAJE\\s+DE\\s+PARTICIPANTES\\s+QUE\\s+APLICAN\\s+LO\\s+APRENDIDO" },
  { key: "seguimiento", label: "Seguimiento Post-Curso", pattern: "SEGUIMIENTO\\s+POST[-\\s]*CURSO", indicator: "Número de participantes que han recibido seguimiento", indicatorPattern: "N[ÚU]MERO\\s+DE\\s+PARTICIPANTES\\s+QUE\\s+HAN\\s+RECIBIDO\\s+SEGUIMIENTO" }
]);
function groupWordLines(pdf) {
  const groups = [];
  (pdf.pages || []).forEach((page) => {
    const words = (page.words || []).filter((word) => text(word.text).trim());
    const sorted = [...words].sort((a, b) => Number(a.y0 || 0) - Number(b.y0 || 0) || Number(a.x0 || 0) - Number(b.x0 || 0));
    sorted.forEach((word) => {
      const centerY = (Number(word.y0 || 0) + Number(word.y1 || 0)) / 2;
      let group = groups.find((candidate) => candidate.pageNumber === Number(page.pageNumber || 0) && Math.abs(candidate.centerY - centerY) <= 10);
      if (!group) {
        group = { pageNumber: Number(page.pageNumber || 0), pageWidth: Number(page.width || page.imageWidth || 0), centerY, words: [] };
        groups.push(group);
      }
      group.words.push(word);
      group.centerY = (group.centerY * (group.words.length - 1) + centerY) / group.words.length;
    });
  });
  return groups.map((group) => {
    group.words.sort((a, b) => Number(a.x0 || 0) - Number(b.x0 || 0));
    return { ...group, text: group.words.map((word) => word.text).join(" ") };
  });
}
function likertFromLayout(pdf, itemLabel) {
  const target = normalized(itemLabel);
  const tokens = target.split(" ").filter((token) => token.length > 3);
  const groups = groupWordLines(pdf);
  const candidates = groups.filter((group) => {
    const line = normalized(group.text);
    return tokens.filter((token) => line.includes(token)).length >= Math.max(1, Math.ceil(tokens.length * 0.5));
  });
  for (const group of candidates) {
    const nearby = groups.filter((candidate) => candidate.pageNumber === group.pageNumber && Math.abs(candidate.centerY - group.centerY) <= 24);
    const marks = nearby.flatMap((candidate) => candidate.words).filter((word) => /^[x×]$/i.test(text(word.text).trim()));
    if (!marks.length || !group.pageWidth) continue;
    const mark = marks.sort((a, b) => Number(b.x0 || 0) - Number(a.x0 || 0))[0];
    const ratio = ((Number(mark.x0 || 0) + Number(mark.x1 || 0)) / 2) / group.pageWidth;
    const optionIndex = ratio < 0.50 ? 0 : ratio < 0.61 ? 1 : ratio < 0.72 ? 2 : ratio < 0.83 ? 3 : 4;
    return { option: LIKERT_OPTIONS[optionIndex], pageNumber: group.pageNumber, xRatio: Number(ratio.toFixed(3)), confidence: "ALTA" };
  }
  return null;
}
function textHasMarkedItem(section, label) {
  const lines = splitCleanLines(section);
  const targetTokens = normalized(label).split(" ").filter((token) => token.length > 3);
  return lines.find((line) => {
    const norm = normalized(line);
    return /[x×]/i.test(line) && targetTokens.filter((token) => norm.includes(token)).length >= Math.max(1, Math.ceil(targetTokens.length * 0.5));
  }) || "";
}
function parseLikert(section, pdf, context, prefix, dimension, labels) {
  return labels.map((label, index) => {
    const evidence = textHasMarkedItem(section, label);
    const exists = normalized(section).includes(normalized(label)) || Boolean(evidence);
    if (!exists) return null;
    const layout = likertFromLayout(pdf, label);
    return {
      ...rowBase(prefix, context, index, label),
      dimension,
      item_evaluado: label,
      respuesta_likert: layout?.option || (evidence ? "MARCA_DETECTADA_SIN_COLUMNA" : "NO_DETERMINADA"),
      valor_likert: layout ? LIKERT_OPTIONS.indexOf(layout.option) + 1 : "",
      pagina_origen: layout?.pageNumber || "",
      posicion_x_relativa: layout?.xRatio || "",
      evidencia_texto: cleanField(evidence || label),
      confianza_extraccion: layout?.confidence || (evidence ? "MEDIA" : "BAJA"),
      requiere_revision: yesNo(!layout),
      observacion_extraccion: layout ? "" : "Se detectó el ítem, pero el texto plano no permite asegurar en qué columna Likert estaba la marca."
    };
  }).filter(Boolean);
}
function objectiveRows(section, context) {
  const definitions = [
    { label: "Comprender los conceptos clave del tema", pattern: "COMPRENDER\\s+LOS\\s+CONCEPTOS\\s+CLAVE\\s+DEL\\s+TEMA" },
    { label: "Aplicar conocimientos en casos prácticos", pattern: "APLICAR\\s+CONOCIMIENTOS\\s+EN\\s+CASOS\\s+PR[ÁA]CTICOS" },
    { label: "Desarrollar habilidades de presentación", pattern: "DESARROLLAR\\s+HABILIDADES\\s+DE\\s+PRESENTACI[OÓ]N" }
  ];
  const value = compact(section);
  return definitions.map((definition, index) => {
    const start = regexIndex(value, definition.pattern);
    if (start < 0) return null;
    const end = minPositive(definitions.slice(index + 1).map((next) => regexIndex(value, next.pattern, start + 1)).filter((position) => position > start), value.length);
    const segment = cleanField(value.slice(start, end));
    const parsed = parseResultValue(segment.replace(new RegExp(definition.pattern, "i"), ""));
    const observation = cleanField(segment.replace(new RegExp(definition.pattern, "i"), "").replace(parsed.resultado_texto, ""));
    return {
      ...rowBase("objetivo-instrumento", context, index, definition.label),
      objetivo_aprendizaje: definition.label,
      porcentaje_cumplido: parsed.unidad === "PORCENTAJE" ? parsed.valor_numerico : "",
      resultado_texto: parsed.resultado_texto,
      observaciones: observation,
      evidencia_texto: segment,
      requiere_revision: yesNo(parsed.unidad !== "PORCENTAJE"),
      observacion_extraccion: parsed.unidad === "PORCENTAJE" ? "" : "No se detectó un porcentaje de cumplimiento."
    };
  }).filter(Boolean);
}
function genericMetricRows(section, definitions, context, prefix, dimension) {
  return definitions.map((definition, index) => {
    const captured = captureKnownRow(section, definition, definitions.slice(index + 1));
    if (!captured) return null;
    return {
      ...rowBase(prefix, context, index, definition.key),
      dimension,
      item_evaluado: definition.label,
      ...captured.parsed,
      observaciones: captured.observation,
      evidencia_texto: captured.segment,
      requiere_revision: yesNo(captured.parsed.valor_numerico === ""),
      observacion_extraccion: captured.parsed.valor_numerico === "" ? "No se detectó un resultado numérico." : ""
    };
  }).filter(Boolean);
}
const TRANSFER_ROWS = Object.freeze([
  { key: "claridad_aplicacion", label: "Porcentaje de participantes con claridad sobre cómo aplicar lo aprendido", pattern: "PORCENTAJE\\s+DE\\s+PARTICIPANTES\\s+CON\\s+CLARIDAD\\s+SOBRE\\s+C[OÓ]MO\\s+APLICAR\\s+LO\\s+APRENDIDO" },
  { key: "nuevas_habilidades", label: "Número de participantes que esperan utilizar nuevas habilidades", pattern: "N[ÚU]MERO\\s+DE\\s+PARTICIPANTES\\s+QUE\\s+ESPERAN\\s+UTILIZAR\\s+NUEVAS\\s+HABILIDADES" },
  { key: "apoyo_organizacional", label: "Porcentaje de participantes que perciben apoyo organizacional para la aplicación", pattern: "PORCENTAJE\\s+DE\\s+PARTICIPANTES\\s+QUE\\s+PERCIBEN\\s+APOYO\\s+ORGANIZACIONAL\\s+PARA\\s+LA\\s+APLICACI[OÓ]N" }
]);
const IMPACT_ROWS = Object.freeze([
  { key: "productividad", label: "Mejora en la Productividad", pattern: "MEJORA\\s+EN\\s+LA\\s+PRODUCTIVIDAD" },
  { key: "objetivos_estrategicos", label: "Alineación con Objetivos Estratégicos", pattern: "ALINEACI[OÓ]N\\s+CON\\s+OBJETIVOS\\s+ESTRAT[ÉE]GICOS" },
  { key: "errores_retrabajo", label: "Reducción de Errores / Retrabajo", pattern: "REDUCCI[OÓ]N\\s+DE\\s+ERRORES\\s*[/\\-]?\\s*RETRABAJO" },
  { key: "calidad_trabajo", label: "Incremento en la Calidad del Trabajo", pattern: "INCREMENTO\\s+EN\\s+LA\\s+CALIDAD\\s+DEL\\s+TRABAJO" }
]);
function recommendationRows(section, context) {
  const value = compact(section);
  const areas = [
    { label: "Interacción con los facilitadores", pattern: "INTERACCI[OÓ]N\\s+CON\\s+LOS\\s+FACILITADORES" },
    { label: "Bibliografía utilizada", pattern: "BIBLIOGRAF[IÍ]A\\s+UTILIZADA" },
    { label: "Reducción del número de exámenes", pattern: "REDUCCI[OÓ]N\\s+DEL\\s+N[ÚU]MERO\\s+DE\\s+EX[ÁA]MENES" }
  ];
  const rows = areas.map((area, index) => {
    const start = regexIndex(value, area.pattern);
    if (start < 0) return null;
    const end = minPositive(areas.slice(index + 1).map((next) => regexIndex(value, next.pattern, start + 1)).filter((position) => position > start), value.length);
    const segment = cleanField(value.slice(start, end));
    const withoutArea = cleanField(segment.replace(new RegExp(area.pattern, "i"), ""));
    const responsibleMatch = withoutArea.match(/(?:MSG[.,]?|MGS[.,]?|ING[.,]?|DR[.,]?)\s+[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.' -]{4,80}/i);
    const responsible = cleanField(responsibleMatch?.[0] || "");
    const action = cleanField(responsible ? withoutArea.replace(responsible, "") : withoutArea);
    return {
      ...rowBase("mejora-instrumento", context, index, area.label),
      numero_accion: index + 1,
      area_mejora: area.label,
      accion_recomendada: action,
      responsable: responsible,
      fecha_estimada: /no\s+se\s+puede\s+proponer\s+una\s+fecha/i.test(action) ? "NO DEFINIDA" : "",
      estado: "PROPUESTA",
      evidencia_texto: segment,
      requiere_revision: yesNo(!responsible),
      observacion_extraccion: responsible ? "" : "No se detectó responsable de forma inequívoca."
    };
  }).filter(Boolean);
  if (rows.length || !value) return rows;
  return [{
    ...rowBase("mejora-instrumento", context, 0, value.slice(0, 80)),
    numero_accion: 1,
    area_mejora: "GENERAL",
    accion_recomendada: value,
    responsable: "",
    fecha_estimada: "",
    estado: "PROPUESTA",
    evidencia_texto: value,
    requiere_revision: "SI",
    observacion_extraccion: "La tabla de mejora no pudo dividirse en filas conocidas."
  }];
}
function extractResponsibilities(source, context) {
  const compactSource = compact(source.slice(0, 9000));
  const roles = ["ELABORADO POR", "REVISADO POR", "APROBADO POR"];
  const names = [...compactSource.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|$)/gi)].map((match) => cleanField(match[1]));
  const cargos = [...compactSource.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|$)/gi)].map((match) => cleanField(match[1]));
  return roles.map((role, index) => ({
    ...rowBase("responsable-instrumento", context, index, `${role}|${names[index] || ""}`),
    rol_responsable: role,
    nombre_responsable: names[index] || "",
    cargo_responsable: cargos[index] || "",
    estado_firma: names[index] ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO",
    requiere_revision: yesNo(!names[index]),
    observacion_extraccion: names[index] ? "" : "No se detectó el nombre del responsable."
  }));
}
function extractAttachments(source, context) {
  const section = sliceByPatterns(source, ["(?:^|\\n)\\s*ANEXOS?"], ["(?:^|\\n)\\s*(?:ELABORADO|REVISADO|APROBADO)\\s+POR"]);
  return uniqueValues(splitCleanLines(section).filter((line) => line.length > 3)).slice(0, 50).map((description, index) => ({
    ...rowBase("anexo-instrumento", context, index, description),
    numero_anexo: index + 1,
    descripcion_anexo: description,
    requiere_revision: "NO",
    observacion_extraccion: ""
  }));
}
function ocrRows(pdf, context) {
  return (pdf.pages || []).map((page, index) => {
    const confidence = Number(page.confidence || 0);
    const low = confidence > 0 && confidence < 65;
    return {
      ...rowBase("ocr-instrumento", context, index, page.pageNumber || index + 1),
      pagina: Number(page.pageNumber || index + 1),
      metodo_extraccion: page.method || pdf.extractionMethod || "digital",
      confianza_ocr: confidence,
      longitud_texto: Number(page.textLength || text(page.text).length || 0),
      total_palabras_con_posicion: Array.isArray(page.words) ? page.words.length : 0,
      ancho_pagina: Number(page.width || page.imageWidth || 0),
      alto_pagina: Number(page.height || page.imageHeight || 0),
      requiere_revision: yesNo(low),
      observacion_extraccion: low ? "Confianza OCR baja." : ""
    };
  });
}
function legacyItems(...groups) {
  return groups.flat().map((row, index) => ({
    ...row,
    id: row.id || `legacy-item-${index}`,
    numero_item: index + 1,
    dimension: row.dimension || "GENERAL",
    criterio_pregunta: row.item_evaluado || row.criterio || row.objetivo_aprendizaje || "",
    respuesta_seleccionada: row.respuesta_likert || row.resultado_texto || "",
    puntaje: row.valor_likert || row.valor_numerico || row.porcentaje_cumplido || ""
  }));
}
function summaryRow(context, groups, participantCount) {
  const quant = groups.quantitative;
  const learning = quant.find((row) => normalized(row.criterio).includes("aprendizaje"));
  const satisfaction = quant.find((row) => normalized(row.criterio).includes("satisfaccion"));
  const approval = quant.find((row) => normalized(row.indicador).includes("tasa de aprobacion"));
  const applicability = quant.find((row) => normalized(row.criterio).includes("aplicabilidad"));
  const followUp = quant.find((row) => normalized(row.criterio).includes("seguimiento"));
  const objectiveAverage = average(groups.objectives.map((row) => row.porcentaje_cumplido));
  const impactAverage = average(groups.impact.map((row) => row.valor_numerico));
  const participantLikertAverage = average(groups.participantLikert.map((row) => row.valor_likert));
  return {
    ...rowBase("resultado-instrumento", context, 0, `${approval?.valor_numerico || ""}|${participantCount}`),
    total_participantes: participantCount,
    promedio_calificacion: learning?.valor_numerico ?? "",
    escala_maxima_calificacion: learning?.escala_maxima ?? "",
    promedio: learning?.valor_numerico ?? participantLikertAverage,
    resultado_promedio: learning?.valor_numerico ?? participantLikertAverage,
    puntaje: participantLikertAverage,
    participantes_satisfechos: satisfaction?.valor_numerico ?? "",
    tasa_aprobacion: approval?.valor_numerico ?? "",
    porcentaje: approval?.valor_numerico ?? "",
    aplicabilidad_conocimientos: applicability?.valor_numerico ?? "",
    participantes_con_seguimiento: followUp?.valor_numerico ?? "",
    promedio_cumplimiento_objetivos: objectiveAverage,
    promedio_impacto_organizacional: impactAverage,
    total_items_likert: groups.participantLikert.length + groups.facilitatorLikert.length + groups.commitmentLikert.length,
    total_items_likert_resueltos: [...groups.participantLikert, ...groups.facilitatorLikert, ...groups.commitmentLikert].filter((row) => Number(row.valor_likert) > 0).length,
    nivel_resultado: approval?.valor_numerico === "" || approval == null ? "NO_DETERMINADO" : approval.valor_numerico >= 90 ? "ALTO" : approval.valor_numerico >= 70 ? "MEDIO" : "BAJO",
    requiere_revision: yesNo(!quant.length || !participantCount),
    observacion_extraccion: !participantCount ? "No se detectaron participantes." : ""
  };
}
function parseDocument(pdf) {
  const digitalText = normalizeLineBreaks(pdf.digitalText || "");
  const ocrText = normalizeLineBreaks(pdf.ocrText || "");
  const raw = normalizeLineBreaks(digitalText || pdf.text || ocrText || "");
  const fallbackRaw = normalizeLineBreaks(ocrText || pdf.text || raw);
  const combined = raw.length >= fallbackRaw.length * 0.6 ? raw : fallbackRaw;
  const fileName = pdf.fileName || path.basename(pdf.filePath || "");
  const code = parseFlexibleCode(`${combined} ${fallbackRaw} ${fileName}`, "135");
  const id = createDocumentId(pdf.filePath || fileName, pdf.index || 0, code, pdf.fileHash || "", "instrumento-evaluacion");
  const context = { id_documento: id, codigo_documento: code, periodo: extractPeriodoFromCodigo(code) };
  const general = extractGeneralFields(combined);
  const date = parseDateFromText(combined);
  const pagination = declaredPages(combined);
  const participants = participantRows(combined, pdf, context);
  const resultsSection = sliceByPatterns(combined, ["(?:^|\\n)\\s*3[.)]?\\s*RESULTADOS\\s+DE\\s+EVALUACI[OÓ]N"], ["(?:^|\\n)\\s*8[.)]?\\s*RECOMENDACIONES"] ) || combined;
  const resourceSection = sliceByPatterns(resultsSection, ["EVALUACI[OÓ]N\\s+DEL\\s+USO\\s+DE\\s+RECURSOS"], ["EVALUACI[OÓ]N\\s+DE\\s+RESULTADOS\\s+CUANTITATIVOS"] ) || resultsSection;
  const quantitativeSection = sliceByPatterns(resultsSection, ["EVALUACI[OÓ]N\\s+DE\\s+RESULTADOS\\s+CUANTITATIVOS"], ["EVALUACI[OÓ]N\\s+CUALITATIVA\\s+CON\\s+ESCALA\\s+DE\\s+LIKERT"] ) || resultsSection;
  const participantLikertSection = sliceByPatterns(resultsSection, ["EVALUACI[OÓ]N\\s+CUALITATIVA\\s+CON\\s+ESCALA\\s+DE\\s+LIKERT"], ["CUMPLIMIENTO\\s+DE\\s+LOS\\s+OBJETIVOS\\s+DE\\s+APRENDIZAJE"] );
  const objectiveSection = sliceByPatterns(resultsSection, ["CUMPLIMIENTO\\s+DE\\s+LOS\\s+OBJETIVOS\\s+DE\\s+APRENDIZAJE"], ["(?:^|\\n)\\s*4[.)]?\\s*EVALUACI[OÓ]N\\s+DE\\s+LA\\s+SATISFACCI[OÓ]N\\s+DEL\\s+FACILITADOR"] );
  const facilitatorSection = sliceByPatterns(combined, ["(?:^|\\n)\\s*4[.)]?\\s*EVALUACI[OÓ]N\\s+DE\\s+LA\\s+SATISFACCI[OÓ]N\\s+DEL\\s+FACILITADOR"], ["(?:^|\\n)\\s*5[.)]?\\s*EVALUACI[OÓ]N\\s+DEL\\s+COMPROMISO"] );
  const commitmentSection = sliceByPatterns(combined, ["(?:^|\\n)\\s*5[.)]?\\s*EVALUACI[OÓ]N\\s+DEL\\s+COMPROMISO"], ["(?:^|\\n)\\s*6[.)]?\\s*EVALUACI[OÓ]N\\s+DE\\s+LA\\s+TRANSFERENCIA"] );
  const transferSection = sliceByPatterns(combined, ["(?:^|\\n)\\s*6[.)]?\\s*EVALUACI[OÓ]N\\s+DE\\s+LA\\s+TRANSFERENCIA"], ["(?:^|\\n)\\s*7[.)]?\\s*EVALUACI[OÓ]N\\s+DEL\\s+IMPACTO"] );
  const impactSection = sliceByPatterns(combined, ["(?:^|\\n)\\s*7[.)]?\\s*EVALUACI[OÓ]N\\s+DEL\\s+IMPACTO"], ["(?:^|\\n)\\s*8[.)]?\\s*RECOMENDACIONES"] );
  const improvementSection = sliceByPatterns(combined, ["(?:^|\\n)\\s*8[.)]?\\s*RECOMENDACIONES(?:\\s+Y\\s+MEJORA)?"], ["(?:^|\\n)\\s*ANEXOS?", "(?:^|\\n)\\s*(?:ELABORADO|REVISADO|APROBADO)\\s+POR"] );

  const resources = parseKnownTable(resourceSection, RESOURCE_ROWS, context, "recurso-metodologia-instrumento", "USO_RECURSOS_METODOLOGIA");
  const quantitative = parseKnownTable(quantitativeSection, QUANTITATIVE_ROWS, context, "resultado-cuantitativo-instrumento", "RESULTADOS_CUANTITATIVOS");
  const participantLikert = parseLikert(participantLikertSection, pdf, context, "likert-participante-instrumento", "PERCEPCION_PARTICIPANTES", [
    "Claridad de los Contenidos", "Relevancia del Material", "Metodología Utilizada", "Interacción del Facilitador", "Satisfacción General"
  ]);
  const objectives = objectiveRows(objectiveSection, context);
  const facilitatorLikert = parseLikert(facilitatorSection, pdf, context, "likert-facilitador-instrumento", "SATISFACCION_FACILITADOR", [
    "Calidad de los Recursos", "Apoyo Institucional", "Interacción con los Participantes", "Efectividad de la Metodología", "Logro de Objetivos de Aprendizaje"
  ]);
  const commitmentLikert = parseLikert(commitmentSection, pdf, context, "compromiso-instrumento", "COMPROMISO_MOTIVACION", [
    "Incremento en la Motivación", "Compromiso con la Aplicación de lo Aprendido", "Confianza en Implementar Nuevas Habilidades"
  ]);
  const transfer = genericMetricRows(transferSection, TRANSFER_ROWS, context, "transferencia-instrumento", "TRANSFERENCIA_APRENDIZAJE");
  const impact = genericMetricRows(impactSection, IMPACT_ROWS, context, "impacto-instrumento", "IMPACTO_ORGANIZACIONAL");
  const improvements = recommendationRows(improvementSection, context);
  const responsables = extractResponsibilities(combined, context);
  const anexos = extractAttachments(combined, context);
  const ocrPaginas = ocrRows(pdf, context);
  const items = legacyItems(participantLikert, facilitatorLikert, commitmentLikert, resources, quantitative, objectives, transfer, impact);
  const summary = summaryRow(context, { quantitative, objectives, impact, participantLikert, facilitatorLikert, commitmentLikert }, participants.length);

  const warnings = [];
  if (!code) warnings.push("No se detectó un código institucional PRO-135.");
  if (!general.nombre_capacitacion) warnings.push("No se detectó el nombre de la capacitación.");
  if (!date.raw) warnings.push("No se detectó la fecha de elaboración.");
  if (!participants.length) warnings.push("No se detectaron participantes en la matriz.");
  if (!quantitative.length) warnings.push("No se detectó la tabla de resultados cuantitativos.");
  if (pagination.inconsistent) warnings.push("La paginación declarada es inconsistente dentro del documento.");
  if (pagination.maxTotal && pdf.pageCount && pagination.maxTotal !== Number(pdf.pageCount)) warnings.push(`La paginación declara ${pagination.maxTotal} páginas, pero el archivo contiene ${pdf.pageCount}.`);
  const unresolvedLikert = [...participantLikert, ...facilitatorLikert, ...commitmentLikert].filter((row) => row.requiere_revision === "SI").length;
  if (unresolvedLikert) warnings.push(`${unresolvedLikert} respuesta(s) Likert requieren revisión de la columna marcada.`);
  const revision = yesNo(warnings.length > 0);

  const archivo = {
    ...rowBase("archivo-instrumento", context, 0, fileName),
    nombre_archivo: fileName,
    ruta_archivo: pdf.filePath || "",
    hash_archivo: pdf.fileHash || "",
    codigo_original: code,
    numero_registro: extractRegistroFromCodigo(code),
    total_paginas: Number(pdf.pageCount || 0),
    paginas_declaradas: pagination.maxTotal,
    paginacion_inconsistente: yesNo(pagination.inconsistent || (pagination.maxTotal && Number(pdf.pageCount || 0) !== pagination.maxTotal)),
    metodo_extraccion: pdf.extractionMethod || "digital",
    paginas_digitales: Number(pdf.digitalPageCount || 0),
    paginas_ocr: Number(pdf.ocrPageCount || 0),
    confianza_ocr: Number(pdf.ocrConfidence || 0),
    tiene_coordenadas_ocr: yesNo((pdf.pages || []).some((page) => Array.isArray(page.words) && page.words.length)),
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: revision,
    observacion_extraccion: warnings.join(" | ")
  };
  const datosGenerales = {
    ...rowBase("datos-instrumento", context, 0, general.nombre_capacitacion),
    tipo_documental: DEFINITION.label,
    estructura_detectada: "PRO-135-EVALUACION-CAPACITACION-V2",
    fecha_documento: date.iso,
    fecha_documento_texto: date.raw,
    nombre_capacitacion: general.nombre_capacitacion,
    titulo_documento: general.titulo_documento,
    periodo_capacitacion: general.periodo_capacitacion,
    periodo_evaluado: general.periodo_capacitacion,
    facilitador: general.facilitador,
    publico_dirigido: general.publico_dirigido,
    carrera: general.carrera,
    version_documento: general.version_documento,
    total_participantes: participants.length,
    total_resultados_recursos: resources.length,
    total_resultados_cuantitativos: quantitative.length,
    total_items_likert_participantes: participantLikert.length,
    total_objetivos: objectives.length,
    total_items_likert_facilitador: facilitatorLikert.length,
    total_items_compromiso: commitmentLikert.length,
    total_indicadores_transferencia: transfer.length,
    total_indicadores_impacto: impact.length,
    total_acciones_mejora: improvements.length,
    total_responsables: responsables.length,
    total_anexos: anexos.length,
    requiere_revision: revision,
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: "instrumento-evaluacion",
    id_documento: id,
    archivo,
    datos_generales: datosGenerales,
    participantes: participants,
    recursos_metodologia: resources,
    resultados_cuantitativos: quantitative,
    likert_participantes: participantLikert,
    objetivos: objectives,
    likert_facilitador: facilitatorLikert,
    compromiso_motivacion: commitmentLikert,
    transferencia: transfer,
    impacto: impact,
    mejoras: improvements,
    items,
    resultados: [summary],
    responsables,
    anexos,
    ocr_paginas: ocrPaginas,
    warnings,
    source: {
      file_hash: pdf.fileHash || "",
      extraction_method: pdf.extractionMethod || "digital",
      digital_pages: Number(pdf.digitalPageCount || 0),
      ocr_pages: Number(pdf.ocrPageCount || 0),
      ocr_confidence: Number(pdf.ocrConfidence || 0),
      text_length: combined.length,
      digital_text_length: digitalText.length,
      ocr_text_length: ocrText.length
    }
  };
}
function parseDocuments(input) {
  const parsed = [];
  const errors = [];
  (Array.isArray(input) ? input : []).forEach((document) => {
    if (!document || !document.ok) {
      errors.push({ fileName: document?.fileName || "", errors: document?.errors || ["Documento inválido."] });
      return;
    }
    try { parsed.push(parseDocument(document)); }
    catch (error) { errors.push({ fileName: document.fileName || "", errors: [error.message || "No se pudo analizar el instrumento de evaluación."] }); }
  });
  return {
    documentType: "instrumento-evaluacion",
    total: parsed.length + errors.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
    parsed,
    errors
  };
}
function validateRows(rows, required = ["id_documento"]) {
  const warnings = [];
  (rows || []).forEach((row, index) => required.forEach((field) => {
    if (row[field] === "" || row[field] == null) warnings.push(`Fila ${index + 1}: falta ${field}.`);
  }));
  return { ok: !warnings.length, totalRows: (rows || []).length, warningCount: warnings.length, warnings };
}
function buildTables(input) {
  const documents = Array.isArray(input) ? input : (input?.parsed || []);
  const tables = {
    [TABLE_NAMES.archivos]: documents.map((doc) => doc.archivo),
    [TABLE_NAMES.datos]: documents.map((doc) => doc.datos_generales),
    [TABLE_NAMES.participantes]: documents.flatMap((doc) => doc.participantes || []),
    [TABLE_NAMES.recursos_metodologia]: documents.flatMap((doc) => doc.recursos_metodologia || []),
    [TABLE_NAMES.resultados_cuantitativos]: documents.flatMap((doc) => doc.resultados_cuantitativos || []),
    [TABLE_NAMES.likert_participantes]: documents.flatMap((doc) => doc.likert_participantes || []),
    [TABLE_NAMES.objetivos]: documents.flatMap((doc) => doc.objetivos || []),
    [TABLE_NAMES.likert_facilitador]: documents.flatMap((doc) => doc.likert_facilitador || []),
    [TABLE_NAMES.compromiso_motivacion]: documents.flatMap((doc) => doc.compromiso_motivacion || []),
    [TABLE_NAMES.transferencia]: documents.flatMap((doc) => doc.transferencia || []),
    [TABLE_NAMES.impacto]: documents.flatMap((doc) => doc.impacto || []),
    [TABLE_NAMES.mejoras]: documents.flatMap((doc) => doc.mejoras || []),
    [TABLE_NAMES.items]: documents.flatMap((doc) => doc.items || []),
    [TABLE_NAMES.resultados]: documents.flatMap((doc) => doc.resultados || []),
    [TABLE_NAMES.responsables]: documents.flatMap((doc) => doc.responsables || []),
    [TABLE_NAMES.anexos]: documents.flatMap((doc) => doc.anexos || []),
    [TABLE_NAMES.ocr]: documents.flatMap((doc) => doc.ocr_paginas || [])
  };
  const validations = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, validateRows(rows)]));
  const rowsByTable = {};
  const warningsByTable = {};
  let totalRows = 0;
  let totalWarnings = 0;
  let revisionRows = 0;
  Object.entries(tables).forEach(([name, rows]) => {
    rowsByTable[name] = rows.length;
    warningsByTable[name] = validations[name].warningCount;
    totalRows += rows.length;
    totalWarnings += validations[name].warningCount;
    revisionRows += rows.filter((row) => row.requiere_revision === "SI").length;
  });
  return {
    tables,
    validations,
    summary: {
      total_tables: Object.keys(tables).length,
      total_rows: totalRows,
      total_warnings: totalWarnings,
      requiere_revision_rows: revisionRows,
      rows_by_table: rowsByTable,
      warnings_by_table: warningsByTable,
      estado_general: totalWarnings || revisionRows ? "REVISAR" : "OK"
    }
  };
}
function flattenWarnings(validations) {
  return Object.entries(validations || {}).flatMap(([tabla, validation]) =>
    (validation.warnings || []).map((advertencia) => ({ tabla, advertencia })));
}
function validateParsedDocument(document) {
  const general = document?.datos_generales || {};
  const warnings = [];
  if (!document?.id_documento) warnings.push("Falta identificador del documento.");
  if (!general.codigo_documento) warnings.push("Falta código institucional PRO-135.");
  if (!general.nombre_capacitacion) warnings.push("Falta nombre de la capacitación.");
  if (!general.fecha_documento) warnings.push("Falta fecha del documento.");
  if (!(document?.participantes || []).length) warnings.push("No se detectaron participantes.");
  if (!(document?.resultados_cuantitativos || []).length) warnings.push("No se detectaron resultados cuantitativos.");
  return { ok: !warnings.length, documentId: document?.id_documento || "", warnings };
}

module.exports = {
  DEFINITION,
  TABLE_NAMES,
  parseDocument,
  parseDocuments,
  buildTables,
  validateRows,
  flattenWarnings,
  validateParsedDocument,
  helpers: {
    extractGeneralFields,
    participantRows,
    parseResultValue,
    parseKnownTable,
    parseLikert,
    objectiveRows,
    recommendationRows
  }
};
