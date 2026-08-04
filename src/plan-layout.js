"use strict";

const {
  evaluateRecord,
  extractCode,
  extractPeriod
} = require("./plan-parser");

const COLUMN_LIMITS = Object.freeze({
  numberEnd: 0.085,
  nameEnd: 0.445,
  hoursEnd: 0.585,
  dateEnd: 0.775
});

const ACTIVITY_ALIASES = Object.freeze([
  ["hacking", "ciberseguridad", "seguridad", "ethical"],
  ["inteligencia", "artificial", "generativa", "ia"],
  ["apa", "normas", "gamificacion"],
  ["valores", "habilidades", "blandas", "educativos"],
  ["fibra", "optica", "ftth", "otdr"],
  ["programacion", "software", "codigo", "desarrollo"]
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compact(value) {
  return String(value || "")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();
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
  const lower = new Set(["de", "del", "la", "las", "los", "y", "e", "en", "a"]);
  return clean.toLowerCase().split(" ").map((word, index) => {
    if (index > 0 && lower.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function groupWordsByVisualLine(words, tolerance = 12) {
  const sorted = [...(Array.isArray(words) ? words : [])]
    .filter((word) => compact(word.text))
    .sort((left, right) => left.centerY - right.centerY || left.left - right.left);
  const lines = [];
  for (const word of sorted) {
    let line = lines.find((candidate) => Math.abs(candidate.centerY - word.centerY) <= tolerance);
    if (!line) {
      line = { centerY: word.centerY, words: [] };
      lines.push(line);
    }
    line.words.push(word);
    line.centerY = line.words.reduce((sum, item) => sum + item.centerY, 0) / line.words.length;
  }
  return lines
    .sort((left, right) => left.centerY - right.centerY)
    .map((line) => line.words.sort((left, right) => left.left - right.left));
}

function textFromWords(words) {
  return groupWordsByVisualLine(words)
    .map((line) => line.map((word) => word.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function cleanCell(value) {
  return compact(value)
    .replace(/^(?:#|n[º°o]?|nombre\s+de\s+capacitaci[oó]n\s+propuesta|horas\s+de\s+capacitaci[oó]n\s+propuesta|fecha\s+de\s+propuesta\s+de\s+ejecuci[oó]n|tipo\s+de\s+capacitaci[oó]n\s+propuesta)\s*/i, "")
    .replace(/^[|:;,.\-–—\s]+|[|:;,.\-–—\s]+$/g, "")
    .trim();
}

function rowAnchors(words, width) {
  const candidates = (Array.isArray(words) ? words : [])
    .filter((word) => word.centerX / width <= 0.15)
    .filter((word) => /^\d{1,2}$/.test(compact(word.text)))
    .map((word) => ({ number: Number(word.text), y: word.centerY, word }))
    .filter((item) => item.number >= 1 && item.number <= 30)
    .sort((left, right) => left.y - right.y);

  const anchors = [];
  candidates.forEach((candidate) => {
    const existing = anchors.find((item) => Math.abs(item.y - candidate.y) < 18);
    if (!existing) anchors.push(candidate);
    else if (candidate.word.confidence > existing.word.confidence) Object.assign(existing, candidate);
  });
  return anchors;
}

function wordsForRow(words, anchors, index) {
  const current = anchors[index];
  const previous = anchors[index - 1];
  const next = anchors[index + 1];
  const top = previous ? (previous.y + current.y) / 2 : current.y - (next ? (next.y - current.y) / 2 : 45);
  const bottom = next ? (current.y + next.y) / 2 : current.y + (previous ? (current.y - previous.y) / 2 : 60);
  return words.filter((word) => word.centerY >= top && word.centerY < bottom);
}

function splitColumns(words, width) {
  const output = { number: [], name: [], hours: [], date: [], type: [] };
  words.forEach((word) => {
    const ratio = word.centerX / width;
    if (ratio <= COLUMN_LIMITS.numberEnd) output.number.push(word);
    else if (ratio <= COLUMN_LIMITS.nameEnd) output.name.push(word);
    else if (ratio <= COLUMN_LIMITS.hoursEnd) output.hours.push(word);
    else if (ratio <= COLUMN_LIMITS.dateEnd) output.date.push(word);
    else output.type.push(word);
  });
  return output;
}

function splitDateRange(value) {
  const source = cleanCell(value)
    .replace(/\bDesdo\b/gi, "Desde")
    .replace(/\bhasta\s+el\b/gi, "hasta")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return { start: "", end: "", original: "" };
  const match = source.match(/(?:Desde\s+)?(.+?)\s+hasta\s+(.+)/i);
  if (!match) return { start: source, end: "", original: source };
  return {
    start: cleanCell(match[1]),
    end: cleanCell(match[2]),
    original: source
  };
}

function numericHours(value) {
  const candidates = String(value || "").match(/\b\d{1,4}\b/g) || [];
  const number = candidates.map(Number).find((item) => item > 0 && item <= 1000);
  return number || 0;
}

function parseTableFromWords(table) {
  const words = Array.isArray(table?.words) ? table.words : [];
  const width = Number(table?.rectangle?.width || 0);
  if (!words.length || !width) return [];
  const relativeWords = words.map((word) => ({
    ...word,
    left: word.left - Number(table.rectangle.left || 0),
    right: word.right - Number(table.rectangle.left || 0),
    centerX: word.centerX - Number(table.rectangle.left || 0),
    top: word.top - Number(table.rectangle.top || 0),
    bottom: word.bottom - Number(table.rectangle.top || 0),
    centerY: word.centerY - Number(table.rectangle.top || 0)
  }));
  const anchors = rowAnchors(relativeWords, width);
  if (!anchors.length) return [];

  return anchors.map((anchor, index) => {
    const rowWords = wordsForRow(relativeWords, anchors, index);
    const columns = splitColumns(rowWords, width);
    const date = splitDateRange(textFromWords(columns.date));
    const name = cleanCell(textFromWords(columns.name));
    const type = smartCase(cleanCell(textFromWords(columns.type)));
    const hours = numericHours(textFromWords(columns.hours));
    if (!name && !hours && !date.original && !type) return null;
    return {
      orden: anchor.number || index + 1,
      nombre: smartCase(name),
      horas,
      fecha_inicio_propuesta: date.start,
      fecha_fin_propuesta: date.end,
      fecha_rango_original: date.original,
      tipo,
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: "",
      detalle_compartido_entre_capacitaciones: false,
      origen_extraccion: "OCR_TABLA_POR_CELDAS"
    };
  }).filter(Boolean);
}

function trainingQuality(training) {
  return [
    compact(training?.nombre),
    Number(training?.horas || 0) > 0,
    compact(training?.fecha_inicio_propuesta),
    compact(training?.fecha_fin_propuesta),
    compact(training?.tipo)
  ].filter(Boolean).length;
}

function trainingsQuality(trainings) {
  return (Array.isArray(trainings) ? trainings : []).reduce((sum, training) => sum + trainingQuality(training), 0);
}

function cleanSectionText(value, headings = []) {
  let source = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
  headings.forEach((heading) => {
    source = source.replace(heading, " ");
  });
  return source.replace(/\n{3,}/g, "\n\n").trim();
}

function parseActivities(layout) {
  const text = (layout?.sections?.activities || []).map((item) => item.text).join("\n");
  if (!compact(text)) return { theoretical: [], practical: [] };
  const source = cleanSectionText(text, [/^\s*6\.?\s*Actividades\s*/gim]);
  const theoreticalMatch = source.match(/Te[oó]ricas?\s*([\s\S]*?)(?=Pr[aá]cticas?|$)/i);
  const practicalMatch = source.match(/Pr[aá]cticas?\s*([\s\S]*?)(?=$)/i);
  const parseList = (value) => String(value || "")
    .split(/\n|(?=\s[-=•▪◦●■□◆◇▶►]\s*)/)
    .map((line) => compact(line).replace(/^[-=•▪◦●■□◆◇▶►*"']+\s*/, ""))
    .filter((line) => line && !/^\d+\.?\s/.test(line));
  return {
    theoretical: [...new Set(parseList(theoreticalMatch?.[1]))],
    practical: [...new Set(parseList(practicalMatch?.[1]))]
  };
}

function parseSingleSection(layout, key, headingPatterns) {
  const text = (layout?.sections?.[key] || []).map((item) => item.text).join("\n");
  return compact(cleanSectionText(text, headingPatterns))
    .replace(/^\(?\s*3\s*a\s*5\s*a[nñ]os\s*\)?\s*/i, "")
    .replace(/^[:;,.\-–—\s]+/, "")
    .trim();
}

function tokenSet(value) {
  const normalized = normalize(value);
  const tokens = new Set(normalized.split(" ").filter((token) => token.length >= 2));
  ACTIVITY_ALIASES.forEach((group) => {
    if (group.some((token) => tokens.has(token))) group.forEach((token) => tokens.add(token));
  });
  return tokens;
}

function similarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  let score = 0;
  a.forEach((token) => { if (b.has(token)) score += token.length <= 2 ? 1 : 2; });
  return score;
}

function assignActivities(trainings, activities) {
  const theoreticalAvailable = [...activities.theoretical];
  const practicalAvailable = [...activities.practical];

  return trainings.map((training) => {
    const choose = (items) => {
      const ranked = items.map((item, index) => ({ item, index, score: similarity(training.nombre, item) }))
        .sort((left, right) => right.score - left.score);
      if (!ranked.length || ranked[0].score <= 0) return [];
      return [ranked[0].item];
    };
    const theoretical = choose(theoreticalAvailable);
    const practical = choose(practicalAvailable);
    return {
      ...training,
      actividades_teoricas: theoretical.length ? theoretical : activities.theoretical,
      actividades_practicas: practical.length ? practical : activities.practical,
      detalle_compartido_entre_capacitaciones: !theoretical.length || !practical.length
    };
  });
}

function cleanDiagnosis(record) {
  const output = clone(record);
  const boundaries = [
    /\s+3\.?\s*Evaluaciones?\s+de\s+capacitaci[oó]n[\s\S]*$/i,
    /\s+4\.?\s*Resumen\s+de\s+Capacitaci[oó]n(?:es)?\s+Propuestas?[\s\S]*$/i,
    /\s+5\.?\s*Indicadores[\s\S]*$/i
  ];
  Object.keys(output.diagnostico || {}).forEach((field) => {
    let value = compact(output.diagnostico[field]);
    boundaries.forEach((pattern) => { value = value.replace(pattern, "").trim(); });
    output.diagnostico[field] = value;
  });
  return output;
}

function extractLayoutCode(layout) {
  const source = [
    ...(layout?.codeRegions || []).map((item) => item.text),
    ...(layout?.headers || []).map((item) => item.text)
  ].join("\n");
  return extractCode(source, "");
}

function bestTableTrainings(layout) {
  const candidates = (layout?.tables || [])
    .map((table) => parseTableFromWords(table))
    .filter((rows) => rows.length)
    .sort((left, right) => trainingsQuality(right) - trainingsQuality(left) || right.length - left.length);
  return candidates[0] || [];
}

function applyLayoutToPlan(record, layout = {}) {
  let output = cleanDiagnosis(record);
  let changed = false;
  const warnings = [...(output.advertencias || [])];

  const layoutCode = extractLayoutCode(layout);
  if (layoutCode && layoutCode !== output.docente?.codigo_documento) {
    output.docente.codigo_documento = layoutCode;
    output.docente.periodo_plan = extractPeriod(layoutCode);
    changed = true;
  }

  const structuredTrainings = bestTableTrainings(layout);
  if (structuredTrainings.length
      && (structuredTrainings.length > (output.capacitaciones || []).length
        || trainingsQuality(structuredTrainings) > trainingsQuality(output.capacitaciones))) {
    output.capacitaciones = structuredTrainings;
    changed = true;
    warnings.push(`Se reconstruyeron ${structuredTrainings.length} capacitaciones leyendo las celdas de la tabla.`);
  }

  const activities = parseActivities(layout);
  const impact = parseSingleSection(layout, "impact", [
    /^\s*7\.?\s*Impacto\s+esperado\s+en\s+el\s+docente\s*/gim,
    /^\s*Impacto\s+esperado\s+en\s+el\s+docente\s*/gim
  ]);
  const vision = parseSingleSection(layout, "vision", [
    /^\s*8\.?\s*Visi[oó]n\s+a\s+largo\s+plazo(?:\s*\([^)]*\))?\s*/gim,
    /^\s*Visi[oó]n\s+a\s+largo\s+plazo(?:\s*\([^)]*\))?\s*/gim
  ]);

  if ((output.capacitaciones || []).length && (activities.theoretical.length || activities.practical.length)) {
    output.capacitaciones = assignActivities(output.capacitaciones, activities);
    changed = true;
  }
  output.capacitaciones = (output.capacitaciones || []).map((training) => ({
    ...training,
    impacto_esperado: impact || compact(training.impacto_esperado),
    vision_largo_plazo: vision || compact(training.vision_largo_plazo)
  }));
  if (impact || vision) changed = true;

  output.advertencias = [...new Set(warnings)];
  output.ocr_estructurado = {
    aplicado: changed,
    encabezados: (layout.headers || []).length,
    regiones_codigo: (layout.codeRegions || []).length,
    tablas: (layout.tables || []).length,
    secciones_actividades: (layout.sections?.activities || []).length
  };

  return evaluateRecord(output, {
    isPlan: output.estado !== "ERROR" && output.estado !== "NO_ES_PLAN",
    possiblePlan: true
  });
}

module.exports = {
  COLUMN_LIMITS,
  groupWordsByVisualLine,
  parseTableFromWords,
  parseActivities,
  assignActivities,
  extractLayoutCode,
  bestTableTrainings,
  applyLayoutToPlan
};
