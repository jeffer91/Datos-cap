"use strict";

const { evaluateRecord, extractCode, extractPeriod } = require("./plan-parser");

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function smartCase(value) {
  const source = compact(value);
  if (!source) return "";
  const letters = source.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return source;
  const lowerWords = new Set(["de", "del", "la", "las", "los", "y", "e", "en"]);
  return source.toLowerCase().split(" ").map((word, index) => {
    if (index > 0 && lowerWords.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function cleanCell(value) {
  return compact(value)
    .replace(/^[#*•·▪◦\-–—:;,.\s]+/, "")
    .replace(/[#*•·▪◦\-–—:;,.\s]+$/, "")
    .trim();
}

function wordsFromPages(pages) {
  return (Array.isArray(pages) ? pages : []).flatMap((page) =>
    (Array.isArray(page?.words) ? page.words : []).map((word) => ({
      ...word,
      pageNumber: Number(page.pageNumber || word.pageNumber || 0),
      pageWidth: Number(page.width || word.pageWidth || 0),
      pageHeight: Number(page.height || word.pageHeight || 0)
    }))
  );
}

function textFromWords(words) {
  return (Array.isArray(words) ? words : [])
    .slice()
    .sort((left, right) => left.top - right.top || left.left - right.left)
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function linesFromWords(words, tolerance = 10) {
  const sorted = (Array.isArray(words) ? words : []).slice().sort((left, right) => left.centerY - right.centerY || left.left - right.left);
  const lines = [];
  sorted.forEach((word) => {
    const line = lines.find((candidate) => Math.abs(candidate.centerY - word.centerY) <= tolerance);
    if (line) {
      line.words.push(word);
      line.centerY = line.words.reduce((sum, item) => sum + item.centerY, 0) / line.words.length;
    } else {
      lines.push({ centerY: word.centerY, words: [word] });
    }
  });
  return lines
    .sort((left, right) => left.centerY - right.centerY)
    .map((line) => ({ ...line, text: textFromWords(line.words) }));
}

function extractHeaderCode(layout) {
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  for (const page of pages.slice(0, 2)) {
    const width = Number(page.width || 0);
    const height = Number(page.height || 0);
    const words = Array.isArray(page.words) ? page.words : [];
    if (!width || !height || !words.length) continue;

    const zones = [
      words.filter((word) => word.top <= height * 0.28 && word.left >= width * 0.42),
      words.filter((word) => word.top <= height * 0.35),
      words
    ];
    for (const zone of zones) {
      const code = extractCode(textFromWords(zone));
      if (code) return code;
    }
  }
  return "";
}

function findLineIndex(lines, phrases) {
  const normalizedPhrases = phrases.map(normalize);
  return lines.findIndex((line) => normalizedPhrases.some((phrase) => normalize(line.text).includes(phrase)));
}

function sectionWords(page, startPhrases, endPhrases) {
  const lines = linesFromWords(page.words || [], Math.max(8, Number(page.height || 0) * 0.008));
  const startIndex = findLineIndex(lines, startPhrases);
  if (startIndex < 0) return [];
  let endIndex = lines.length;
  for (const phrase of endPhrases) {
    const candidate = lines.findIndex((line, index) => index > startIndex && normalize(line.text).includes(normalize(phrase)));
    if (candidate >= 0 && candidate < endIndex) endIndex = candidate;
  }
  const startY = lines[startIndex].words.reduce((max, word) => Math.max(max, word.bottom), lines[startIndex].centerY);
  const endY = endIndex < lines.length
    ? lines[endIndex].words.reduce((min, word) => Math.min(min, word.top), lines[endIndex].centerY)
    : Number(page.height || Infinity);
  return (page.words || []).filter((word) => word.top >= startY && word.bottom <= endY);
}

function rowAnchors(words, width) {
  const numberWords = words.filter((word) => {
    if (word.left > width * 0.15) return false;
    const text = cleanCell(word.text);
    return /^\d{1,2}[.)]?$/.test(text);
  });
  const anchors = [];
  numberWords.sort((left, right) => left.centerY - right.centerY).forEach((word) => {
    const number = Number(cleanCell(word.text).replace(/\D/g, ""));
    if (!number) return;
    if (!anchors.some((anchor) => Math.abs(anchor.centerY - word.centerY) < 18)) {
      anchors.push({ centerY: word.centerY, number });
    }
  });
  return anchors.sort((left, right) => left.centerY - right.centerY);
}

function wordsForRow(words, anchors, index) {
  const anchor = anchors[index];
  const previous = anchors[index - 1];
  const next = anchors[index + 1];
  const top = previous ? (previous.centerY + anchor.centerY) / 2 : anchor.centerY - 32;
  const bottom = next ? (anchor.centerY + next.centerY) / 2 : anchor.centerY + 64;
  return words.filter((word) => word.centerY >= top && word.centerY < bottom);
}

function splitColumns(words, width) {
  return {
    number: words.filter((word) => word.centerX < width * 0.08),
    name: words.filter((word) => word.centerX >= width * 0.08 && word.centerX < width * 0.43),
    hours: words.filter((word) => word.centerX >= width * 0.43 && word.centerX < width * 0.56),
    date: words.filter((word) => word.centerX >= width * 0.56 && word.centerX < width * 0.83),
    type: words.filter((word) => word.centerX >= width * 0.83)
  };
}

function splitDateRange(value) {
  const source = cleanCell(value);
  if (!source) return { start: "", end: "", original: "" };
  const match = source.match(/(?:Desde\s+)?(.+?)\s+(?:hasta|al)\s+(.+)/i);
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
      horas: hours,
      fecha_inicio_propuesta: date.start,
      fecha_fin_propuesta: date.end,
      fecha_rango_original: date.original,
      tipo: type,
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
  for (const heading of headings) {
    const pattern = new RegExp(heading, "i");
    const match = source.match(pattern);
    if (match && match.index != null) source = source.slice(0, match.index).trim();
  }
  return source;
}

function parseActivitiesFromLayout(layout) {
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  const output = { teoricas: [], practicas: [], impacto: "", vision: "" };
  for (const page of pages) {
    if (!output.teoricas.length) {
      output.teoricas = sectionWords(page, ["teoricas", "teóricas"], ["practicas", "prácticas"])
        .map((word) => word.text)
        .join(" ")
        .split(/\s*[•▪◦●■□◆◇▶►*]\s*|\s{2,}/)
        .map(cleanCell)
        .filter(Boolean);
    }
    if (!output.practicas.length) {
      output.practicas = sectionWords(page, ["practicas", "prácticas"], ["impacto esperado"])
        .map((word) => word.text)
        .join(" ")
        .split(/\s*[•▪◦●■□◆◇▶►*]\s*|\s{2,}/)
        .map(cleanCell)
        .filter(Boolean);
    }
    if (!output.impacto) {
      output.impacto = cleanSectionText(
        textFromWords(sectionWords(page, ["impacto esperado en el docente"], ["vision a largo plazo", "visión a largo plazo"])),
        ["8\\.?\\s*Visi[oó]n\\s+a\\s+largo\\s+plazo"]
      );
    }
    if (!output.vision) {
      output.vision = cleanSectionText(
        textFromWords(sectionWords(page, ["vision a largo plazo", "visión a largo plazo"], ["formacion docente", "formación docente"])),
        ["Formaci[oó]n\\s+Docente"]
      );
    }
  }
  return output;
}

function meaningfulTokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 4));
}

function trainingMatchesActivity(training, activity) {
  const trainingTokens = meaningfulTokens(training?.nombre);
  const activityTokens = meaningfulTokens(activity);
  for (const token of trainingTokens) {
    if (activityTokens.has(token)) return true;
  }

  const trainingText = normalize(training?.nombre);
  const activityText = normalize(activity);
  const groups = [
    [["ethical", "hacking", "ciberseguridad", "seguridad"], ["hacking", "ciberseguridad", "vulnerabilidades", "ataques"]],
    [["inteligencia", "artificial", "generativa"], ["inteligencia", "artificial", "generativa"]],
    [["apa", "gamificacion"], ["apa", "gamificacion", "referencias", "citacion"]],
    [["valores", "habilidades", "blandas"], ["valores", "habilidades", "blandas"]],
    [["fibra", "optica", "redes"], ["fibra", "optica", "otdr", "ftth", "empalme"]]
  ];
  return groups.some(([trainingWords, activityWords]) =>
    trainingWords.some((word) => trainingText.includes(word))
    && activityWords.some((word) => activityText.includes(word))
  );
}

function distributeActivities(trainings, activities) {
  const list = Array.isArray(activities) ? activities.filter(Boolean) : [];
  if (!trainings.length || !list.length) return;
  if (trainings.length === 1) {
    trainings[0].actividades_teoricas = list;
    return;
  }
  const unmatched = [];
  list.forEach((activity) => {
    const matching = trainings.filter((training) => trainingMatchesActivity(training, activity));
    if (matching.length === 1) matching[0].actividades_teoricas.push(activity);
    else unmatched.push(activity);
  });
  if (unmatched.length) {
    trainings.forEach((training) => {
      if (!training.actividades_teoricas.length) training.actividades_teoricas = [...unmatched];
    });
  }
}

function parseTrainingTable(layout) {
  const pages = Array.isArray(layout?.pages) ? layout.pages : [];
  const candidates = [];
  for (const page of pages) {
    const words = sectionWords(
      page,
      ["resumen de capacitacion propuestas", "resumen de capacitación propuestas", "resumen de capacitaciones propuestas"],
      ["indicadores", "actividades"]
    );
    if (!words.length) continue;
    const left = Math.min(...words.map((word) => word.left));
    const right = Math.max(...words.map((word) => word.right));
    const top = Math.min(...words.map((word) => word.top));
    const bottom = Math.max(...words.map((word) => word.bottom));
    const table = {
      rectangle: { left, top, width: right - left, height: bottom - top },
      words
    };
    const parsed = parseTableFromWords(table);
    if (parsed.length) candidates.push(parsed);
  }
  return candidates.sort((left, right) => trainingsQuality(right) - trainingsQuality(left))[0] || [];
}

function mergeTrainingDetails(trainings, details) {
  const output = trainings.map((training) => ({
    ...training,
    actividades_teoricas: [],
    actividades_practicas: [],
    impacto_esperado: details.impacto,
    vision_largo_plazo: details.vision,
    detalle_compartido_entre_capacitaciones: trainings.length > 1
  }));
  distributeActivities(output, details.teoricas);

  if (details.practicas.length) {
    details.practicas.forEach((activity) => {
      const matching = output.filter((training) => trainingMatchesActivity(training, activity));
      if (matching.length === 1) matching[0].actividades_practicas.push(activity);
    });
    const unassigned = output.filter((training) => !training.actividades_practicas.length);
    if (unassigned.length) {
      unassigned.forEach((training) => { training.actividades_practicas = [...details.practicas]; });
    }
  }
  return output;
}

function applyLayoutToPlan(record, layout = {}) {
  if (!record || !layout || !Array.isArray(layout.pages)) return record;
  const output = JSON.parse(JSON.stringify(record));
  output.docente = output.docente || {};
  const code = extractHeaderCode(layout);
  if (code) {
    output.docente.codigo_documento = code;
    output.docente.periodo_plan = extractPeriod(code);
  }

  const tableTrainings = parseTrainingTable(layout);
  const currentQuality = trainingsQuality(output.capacitaciones);
  const tableQuality = trainingsQuality(tableTrainings);
  if (tableTrainings.length && tableQuality >= currentQuality) {
    const details = parseActivitiesFromLayout(layout);
    output.capacitaciones = mergeTrainingDetails(tableTrainings, details);
    output.advertencias = (output.advertencias || []).filter((warning) =>
      !/texto digital era insuficiente/i.test(String(warning || ""))
    );
    output.advertencias.push("Las capacitaciones se reconstruyeron mediante OCR por celdas.");
  }

  return evaluateRecord(output, {
    isPlan: output.deteccion?.confirmado_como_plan !== false,
    possiblePlan: output.deteccion?.posible_plan !== false
  });
}

module.exports = {
  compact,
  normalize,
  textFromWords,
  linesFromWords,
  extractHeaderCode,
  splitDateRange,
  parseTableFromWords,
  parseActivitiesFromLayout,
  parseTrainingTable,
  trainingQuality,
  trainingsQuality,
  distributeActivities,
  applyLayoutToPlan
};
