"use strict";

const path = require("path");
const crypto = require("crypto");

const QUESTION_DEFINITIONS = Object.freeze([
  {
    field: "capacitacion_12_meses",
    label: "Capacitación realizada en los últimos 12 meses",
    phrases: [
      "en que curso o programa de actualizacion has participado en los ultimos 12 meses",
      "has participado recientemente en algun curso o programa de actualizacion en tu area de ensenanza"
    ],
    patterns: [
      /[¿?*•\s]*(?:en\s+qu[eé]\s+curso\s+o\s+programa\s+de\s+actualizaci[oó]n\s+has\s+participado\s+en\s+los\s+[uú]ltimos\s+12\s+meses|has\s+participado\s+recientemente\s+en\s+alg[uú]n\s+curso\s+o\s+programa\s+de\s+actualizaci[oó]n\s+en\s+tu\s+[aá]rea\s+de\s+ense[nñ]anza)\s*[?¿]*/i
    ]
  },
  {
    field: "avances_aplicados",
    label: "Avances disciplinares aplicados en clases",
    phrases: [
      "podrias mencionar uno o mas avances recientes en tu campo disciplinar que hayas aplicado en tus clases",
      "consideras que tienes suficientes conocimientos sobre las ultimas investigaciones o avances en tu disciplina"
    ],
    patterns: [
      /[¿?*•\s]*(?:podr[ií]as\s+mencionar\s+uno\s+o\s+m[aá]s\s+avances\s+recientes\s+en\s+tu\s+campo\s+disciplinar\s+que\s+hayas\s+aplicado\s+en\s+tus\s+clases|consideras\s+que\s+tienes\s+suficientes\s+conocimientos\s+sobre\s+las\s+[uú]ltimas\s+investigaciones\s+o\s+avances\s+en\s+tu\s+disciplina)\s*[?¿]*/i
    ]
  },
  {
    field: "comodidad_metodologias",
    label: "Nivel de comodidad con nuevas metodologías",
    phrases: [
      "que tan comodo a te sientes implementando nuevas metodologias de ensenanza en el aula",
      "que tan comodo te sientes implementando nuevas metodologias de ensenanza en el aula"
    ],
    patterns: [
      /[¿?*•\s]*qu[eé]\s+tan\s+c[oó]mod[oa](?:\s*\/?\s*a|\s*la)?\s+te\s+sientes\s+implementando\s+nuevas\s+metodolog[ií]as\s+de\s+ense[nñ]anza\s+en\s+el\s+aula\s*[?¿]*/i
    ]
  },
  {
    field: "estrategias_pedagogicas",
    label: "Estrategias pedagógicas utilizadas",
    phrases: [
      "que estrategias pedagogicas innovadoras aplicas en tu practica docente",
      "conoces y aplicas estrategias pedagogicas innovadoras"
    ],
    patterns: [
      /[¿?*•\s]*(?:qu[eé]\s+estrategias\s+pedag[oó]gicas\s+innovadoras\s+aplicas\s+en\s+tu\s+pr[aá]ctica\s+docente|conoces\s+y\s+aplicas\s+estrategias\s+pedag[oó]gicas\s+innovadoras)\s*[?¿]*/i
    ]
  },
  {
    field: "herramientas_tecnologicas",
    label: "Herramientas tecnológicas utilizadas",
    phrases: [
      "que herramientas tecnologicas utilizas regularmente en tu docencia",
      "tienes experiencia en la utilizacion de plataformas virtuales o tecnologia educativa"
    ],
    patterns: [
      /[¿?*•\s]*(?:qu[eé]\s+herramientas\s+tecnol[oó]gicas\s+utilizas\s+regularmente\s+en\s+tu\s+docencia|tienes\s+experiencia\s+en\s+la\s+utilizaci[oó]n\s+de\s+plataformas\s+virtuales\s+o\s+tecnolog[ií]a\s+educativa)\s*[?¿]*/i
    ]
  },
  {
    field: "formacion_adicional",
    label: "Formación académica adicional necesaria",
    phrases: [
      "que formacion academica adicional consideras necesaria para fortalecer tu perfil profesional"
    ],
    patterns: [
      /[¿?*•\s]*qu[eé]\s+formaci[oó]n\s+acad[eé]mica\s+adicional\s+consideras\s+necesaria\s+para\s+fortalecer\s+tu\s+perfil\s+profesional\s*[?¿]*/i
    ]
  },
  {
    field: "nivel_academico_actual",
    label: "Nivel académico actual",
    phrases: ["cual es tu nivel academico actual"],
    patterns: [
      /[¿?*•\s]*cu[aá]l\s+es\s+tu\s+nivel\s+acad[eé]mico\s+actual(?:\s*\(\s*t[ií]tulo\s+registrado\s*\)\s*[?¿]*)?\s*[?¿]*/i
    ]
  },
  {
    field: "tipo_formacion",
    label: "Tipo de formación requerida",
    phrases: ["la formacion academica que propones es especifica o generica"],
    patterns: [
      /[¿?*•\s]*la\s+formaci[oó]n\s+acad[eé]mica\s+que\s+propones\s+es\s+espec[ií]fica\s+o\s+gen[eé]rica\s*[?¿]*/i
    ]
  }
]);

const QUESTION_GROUPS = Object.freeze(
  QUESTION_DEFINITIONS.reduce((output, definition) => {
    output[definition.field] = definition.phrases;
    return output;
  }, {})
);

const ALL_QUESTION_PHRASES = QUESTION_DEFINITIONS.flatMap((item) => item.phrases);
const STATUS_TYPES = [
  "APROBACIÓN", "APROBACION", "CERTIFICACIÓN", "CERTIFICACION",
  "ASISTENCIA", "CURSO", "TALLER", "SEMINARIO", "CONGRESO",
  "DIPLOMADO", "CAPACITACIÓN", "CAPACITACION"
];

const DIAGNOSTIC_LABELS = Object.freeze({
  capacitacion_12_meses: "Capacitación de los últimos 12 meses",
  avances_aplicados: "Avances disciplinares aplicados",
  comodidad_metodologias: "Comodidad con nuevas metodologías",
  estrategias_pedagogicas: "Estrategias pedagógicas",
  herramientas_tecnologicas: "Herramientas tecnológicas",
  formacion_adicional: "Formación académica adicional",
  tipo_formacion: "Tipo de formación"
});

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

function normalizeForMatch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compact(value) {
  return cleanText(value).replace(/\s+/g, " ").trim();
}

function smartCase(value) {
  const clean = compact(value).replace(/^[:\-–—]+\s*/, "");
  if (!clean) return "";
  const letters = clean.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (!letters || letters !== letters.toUpperCase()) return clean;
  const lowerWords = new Set(["de", "del", "la", "las", "los", "y", "e", "en"]);
  return clean.toLowerCase().split(" ").map((word, index) => {
    if (index > 0 && lowerWords.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function valueAfterLabel(lines, labels, options = {}) {
  const normalizedLabels = labels.map(normalizeForMatch);
  const stopLabels = (options.stopLabels || []).map(normalizeForMatch);
  for (let index = 0; index < lines.length; index += 1) {
    const normalizedLine = normalizeForMatch(lines[index]);
    const label = normalizedLabels.find((candidate) => normalizedLine.startsWith(candidate));
    if (!label) continue;

    const original = lines[index];
    const separatorIndex = original.search(/[:：]/);
    let remainder = separatorIndex >= 0 ? original.slice(separatorIndex + 1).trim() : "";
    if (!remainder) {
      const words = original.split(/\s+/);
      const labelWordCount = label.split(" ").length;
      remainder = words.slice(labelWordCount).join(" ").trim();
    }
    if (remainder && !normalizedLabels.includes(normalizeForMatch(remainder))) return compact(remainder);

    const collected = [];
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
      const next = lines[cursor].trim();
      const normalizedNext = normalizeForMatch(next);
      if (!next || stopLabels.some((stop) => normalizedNext.startsWith(stop))) break;
      if (/^\d+[.)]\s/.test(next)) break;
      collected.push(next);
      if (!options.multiline) break;
    }
    if (collected.length) return compact(collected.join(" "));
  }
  return "";
}

function isMajorSection(line) {
  const normalized = normalizeForMatch(line);
  return /^\d+(?:\.\d+)*[.)]?\s+/.test(line.trim())
    || [
      "evaluaciones de capacitacion", "resumen de capacitacion propuestas",
      "indicadores", "actividades", "formacion docente", "impacto esperado en el docente",
      "vision a largo plazo"
    ].some((heading) => normalized === heading || normalized.startsWith(`${heading} `));
}

function isQuestionStart(line) {
  const normalized = normalizeForMatch(line);
  return /^[•▪◦●■□◆◇▶►\-–—*]*\s*[¿?]/.test(line.trim())
    || ALL_QUESTION_PHRASES.some((phrase) => normalized.includes(phrase));
}

function findQuestionAnswer(lines, phrases) {
  const normalizedPhrases = phrases.map(normalizeForMatch);
  for (let index = 0; index < lines.length; index += 1) {
    let joinedQuestion = "";
    let questionEnd = index;
    let found = false;

    for (let cursor = index; cursor < Math.min(lines.length, index + 8); cursor += 1) {
      joinedQuestion = `${joinedQuestion} ${lines[cursor]}`.trim();
      const normalizedJoined = normalizeForMatch(joinedQuestion);
      if (normalizedPhrases.some((phrase) => normalizedJoined.includes(phrase))) found = true;
      questionEnd = cursor;
      if (found && /\?/.test(lines[cursor])) break;
      if (found && cursor > index && isQuestionStart(lines[cursor + 1] || "")) break;
    }
    if (!found) continue;

    const answer = [];
    const lastQuestionLine = lines[questionEnd] || "";
    const afterQuestion = lastQuestionLine.includes("?")
      ? lastQuestionLine.slice(lastQuestionLine.indexOf("?") + 1).trim()
      : "";
    if (afterQuestion) answer.push(afterQuestion);

    for (let cursor = questionEnd + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor].trim();
      if (!line) {
        if (answer.length) break;
        continue;
      }
      if (isQuestionStart(line) || isMajorSection(line)) break;
      const normalizedLine = normalizeForMatch(line);
      if (ALL_QUESTION_PHRASES.some((phrase) => normalizedLine.includes(phrase))) break;
      answer.push(line.replace(/^[•▪◦●■□◆◇▶►*\-–—]+\s*/, ""));
    }
    return compact(answer.join(" "));
  }
  return "";
}

function findQuestionMarkers(source) {
  const markers = [];
  QUESTION_DEFINITIONS.forEach((definition) => {
    let best = null;
    definition.patterns.forEach((pattern) => {
      const match = pattern.exec(source);
      if (!match || match.index == null) return;
      const candidate = {
        field: definition.field,
        start: match.index,
        end: match.index + match[0].length
      };
      if (!best || candidate.start < best.start) best = candidate;
    });
    if (best) markers.push(best);
  });
  return markers.sort((left, right) => left.start - right.start);
}

function cleanExtractedAnswer(value) {
  let answer = compact(value)
    .replace(/^[*•▪◦●■□◆◇▶►\-–—:;,.\s]+/, "")
    .replace(/[*•▪◦●■□◆◇▶►\-–—\s]+$/, "")
    .trim();

  const boundaryPatterns = [
    /\s+(?:4\.?\s*)?Resumen\s+de\s+Capacitaci[oó]n(?:es)?\s+Propuestas?/i,
    /\s+(?:5\.?\s*)?Indicadores/i,
    /\s+(?:6\.?\s*)?Actividades/i,
    /\s+(?:7\.?\s*)?Impacto\s+esperado\s+en\s+el\s+docente/i,
    /\s+(?:8\.?\s*)?Visi[oó]n\s+a\s+largo\s+plazo/i,
    /\s+Formaci[oó]n\s+Docente/i
  ];
  for (const pattern of boundaryPatterns) {
    const match = answer.match(pattern);
    if (match && match.index != null) answer = answer.slice(0, match.index).trim();
  }

  return answer
    .replace(/^\(?\s*t[ií]tulo\s+registrado\s*\)?\s*[?¿:;-]*/i, "")
    .trim();
}

function extractQuestionAnswers(text) {
  const source = compact(text);
  const lines = cleanText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const markers = findQuestionMarkers(source);
  const answers = {};

  markers.forEach((marker, index) => {
    const nextMarker = markers[index + 1];
    const raw = source.slice(marker.end, nextMarker ? nextMarker.start : source.length);
    answers[marker.field] = cleanExtractedAnswer(raw);
  });

  QUESTION_DEFINITIONS.forEach((definition) => {
    if (!answers[definition.field]) {
      answers[definition.field] = cleanExtractedAnswer(findQuestionAnswer(lines, definition.phrases));
    }
  });

  return answers;
}

function extractCode(text, fallbackText = "") {
  const source = compact(`${text || ""} ${fallbackText || ""}`)
    .replace(/PRO\s*[- ]?\s*251/gi, "PRO-251")
    .replace(/RGI\s*([12])/gi, "RGI$1");
  const strict = source.match(/UGPA\s*[- ]?\s*RGI([12])\s*[- ]?\s*(\d{1,3})\s*[- ]?\s*PRO-251\s*[- ]?\s*(20\d{2})\s*[- ]?\s*(1[0-2]|0?[1-9])(?=\D|$)/i);
  if (strict) {
    return `UGPA-RGI${strict[1]}-${String(strict[2]).padStart(2, "0")}-PRO-251-${strict[3]}-${String(strict[4]).padStart(2, "0")}`;
  }
  const loose = source.match(/UGPA.{0,10}RGI([12]).{0,10}(\d{1,3}).{0,14}PRO.{0,6}251.{0,10}(20\d{2}).{0,6}(1[0-2]|0?[1-9])(?=\D|$)/i);
  if (loose) {
    return `UGPA-RGI${loose[1]}-${String(loose[2]).padStart(2, "0")}-PRO-251-${loose[3]}-${String(loose[4]).padStart(2, "0")}`;
  }
  return "";
}

function extractPeriod(code) {
  const match = String(code || "").match(/(20\d{2})-(1[0-2]|0[1-9])$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function getSection(text, startLabels, endLabels) {
  const source = cleanText(text);
  const startPattern = startLabels
    .map((label) => label.split(/\s+/).map(escapeRegExp).join("\\s+"))
    .join("|");
  const startMatch = source.match(new RegExp(startPattern, "i"));
  if (!startMatch || startMatch.index == null) return "";
  const contentStart = startMatch.index + startMatch[0].length;
  const tail = source.slice(contentStart);
  let endIndex = tail.length;
  for (const label of endLabels) {
    const pattern = new RegExp(label.split(/\s+/).map(escapeRegExp).join("\\s+"), "i");
    const match = tail.match(pattern);
    if (match && match.index != null && match.index < endIndex) endIndex = match.index;
  }
  return tail.slice(0, endIndex).trim();
}

function parseDateRange(value) {
  const original = compact(value);
  if (!original) return { inicio: "", fin: "", original: "" };
  const match = original.match(/^Desde\s+(.+?)\s+(?:hasta|al)\s+(.+)$/i);
  if (!match) return { inicio: original, fin: "", original };
  return { inicio: compact(match[1]), fin: compact(match[2]), original };
}

function removeTrainingHeaders(value) {
  return compact(value)
    .replace(/^#?\s*Nombre\s+de\s+Capacitaci[oó]n\s+Propuesta\s*/i, "")
    .replace(/^Horas\s+de\s+Capacitaci[oó]n\s+Propuesta\s*/i, "")
    .replace(/^Fecha\s+de\s+propuesta\s+de\s+ejecuci[oó]n\s*/i, "")
    .replace(/^Tipo\s+de\s+Capacitaci[oó]n\s+Propuesta\s*/i, "")
    .trim();
}

function createTraining(data = {}) {
  const range = parseDateRange(data.fecha_rango_original || "");
  return {
    orden: Number(data.orden || 0),
    nombre: smartCase(data.nombre || ""),
    horas: Number(data.horas || 0),
    fecha_inicio_propuesta: data.fecha_inicio_propuesta || range.inicio,
    fecha_fin_propuesta: data.fecha_fin_propuesta || range.fin,
    fecha_rango_original: data.fecha_rango_original || range.original,
    tipo: smartCase(data.tipo || ""),
    actividades_teoricas: Array.isArray(data.actividades_teoricas) ? data.actividades_teoricas : [],
    actividades_practicas: Array.isArray(data.actividades_practicas) ? data.actividades_practicas : [],
    impacto_esperado: compact(data.impacto_esperado || ""),
    vision_largo_plazo: compact(data.vision_largo_plazo || ""),
    detalle_compartido_entre_capacitaciones: Boolean(data.detalle_compartido_entre_capacitaciones)
  };
}

function parseFlexibleTrainingBlocks(section) {
  const lines = cleanText(section).split("\n").map((line) => line.trim()).filter(Boolean)
    .filter((line) => !/(nombre\s+de\s+capacitaci[oó]n|horas\s+de\s+capacitaci[oó]n|fecha\s+de\s+propuesta|tipo\s+de\s+capacitaci[oó]n)/i.test(line));
  const blocks = [];
  let current = [];
  lines.forEach((line) => {
    if (/^\d{1,2}[.)]?\s+/.test(line) && current.length) {
      blocks.push(current.join(" "));
      current = [line];
    } else {
      current.push(line);
    }
  });
  if (current.length) blocks.push(current.join(" "));

  const typePattern = new RegExp(`\\b(${STATUS_TYPES.map(escapeRegExp).join("|")})\\b`, "i");
  return blocks.map((block) => {
    const orderMatch = block.match(/^\s*(\d{1,2})[.)]?\s+/);
    if (!orderMatch) return null;
    let remainder = block.slice(orderMatch[0].length).trim();
    const typeMatch = remainder.match(typePattern);
    const tipo = typeMatch ? typeMatch[1] : "";
    if (typeMatch) remainder = `${remainder.slice(0, typeMatch.index)} ${remainder.slice(typeMatch.index + typeMatch[0].length)}`.trim();

    const rangeMatch = remainder.match(/Desde\s+(.+?)\s+(?:hasta|al)\s+(.+?)(?=\s+\d{1,4}\s*(?:h|hora|horas)\b|$)/i)
      || remainder.match(/Desde\s+(.+?)\s+(?:hasta|al)\s+(.+)$/i);
    let fechaRango = "";
    if (rangeMatch) {
      fechaRango = `Desde ${compact(rangeMatch[1])} hasta ${compact(rangeMatch[2])}`;
      remainder = `${remainder.slice(0, rangeMatch.index)} ${remainder.slice(rangeMatch.index + rangeMatch[0].length)}`.trim();
    }

    const hoursMatch = remainder.match(/\b(\d{1,4})\s*(?:h|hora|horas)\b/i)
      || remainder.match(/\b(\d{1,3})\b(?=\s+(?:Desde|\d{1,2}[\/-]))/i)
      || remainder.match(/\b(\d{1,3})\b/);
    const horas = hoursMatch ? Number(hoursMatch[1]) : 0;
    if (hoursMatch) remainder = `${remainder.slice(0, hoursMatch.index)} ${remainder.slice(hoursMatch.index + hoursMatch[0].length)}`.trim();

    const nombre = compact(remainder.replace(/^[#*•\-:;,.\s]+/, ""));
    if (!nombre && !horas && !fechaRango && !tipo) return null;
    return createTraining({
      orden: Number(orderMatch[1]),
      nombre,
      horas,
      fecha_rango_original: fechaRango,
      tipo
    });
  }).filter(Boolean);
}

function parseTrainings(text) {
  const section = getSection(
    text,
    ["Resumen de Capacitación Propuestas", "Resumen de Capacitacion Propuestas", "Resumen de Capacitaciones Propuestas"],
    ["5. Indicadores", "Indicadores", "6. Actividades", "Actividades"]
  );
  if (!section) return [];

  const source = removeTrainingHeaders(section);
  const typePattern = STATUS_TYPES.map(escapeRegExp).join("|");
  const expression = new RegExp(
    `(?:^|\\s)(\\d{1,2})\\s+(.+?)\\s+(\\d{1,4})\\s+(Desde\\s+.+?\\s+(?:hasta|al)\\s+.+?)\\s+(${typePattern})(?=\\s+\\d{1,2}\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]|$)`,
    "gi"
  );
  const trainings = [];
  let match;
  while ((match = expression.exec(source)) !== null) {
    trainings.push(createTraining({
      orden: Number(match[1]),
      nombre: match[2],
      horas: Number(match[3]),
      fecha_rango_original: match[4],
      tipo: match[5]
    }));
  }

  return trainings.length ? trainings : parseFlexibleTrainingBlocks(section);
}

function parseActivityList(section) {
  const lines = cleanText(section).split("\n").map((line) => line.trim()).filter(Boolean);
  const values = [];
  for (const line of lines) {
    const clean = line.replace(/^[•▪◦●■□◆◇▶►*\-–—]+\s*/, "").trim();
    if (!clean || /^(te[oó]ricas|pr[aá]cticas)$/i.test(clean)) continue;
    values.push(clean);
  }
  if (values.length <= 1 && values[0]?.includes(";")) {
    return values[0].split(";").map((item) => item.trim()).filter(Boolean);
  }
  return values;
}

function extractSharedTrainingDetails(text) {
  const theory = getSection(text, ["Teóricas", "Teoricas"], ["Prácticas", "Practicas"]);
  const practice = getSection(text, ["Prácticas", "Practicas"], ["7. Impacto esperado en el docente", "Impacto esperado en el docente"]);
  const impact = getSection(text, ["7. Impacto esperado en el docente", "Impacto esperado en el docente"], ["8. Visión a largo plazo", "8. Vision a largo plazo", "Visión a largo plazo", "Vision a largo plazo"]);
  const vision = getSection(text, ["8. Visión a largo plazo", "8. Vision a largo plazo", "Visión a largo plazo", "Vision a largo plazo"], ["Formación Docente", "Formacion Docente"]);
  return {
    actividades_teoricas: parseActivityList(theory),
    actividades_practicas: parseActivityList(practice),
    impacto_esperado: compact(impact).replace(/^\(3\s*a\s*5\s*a[nñ]os\)\s*/i, ""),
    vision_largo_plazo: compact(vision).replace(/^\(3\s*a\s*5\s*a[nñ]os\)\s*/i, "")
  };
}

function planSignalScore(text) {
  const normalized = normalizeForMatch(text);
  let score = 0;
  if (normalized.includes("plan individual de formacion y capacitacion")) score += 3;
  else if (normalized.includes("plan individual") && normalized.includes("formacion")) score += 2;
  if (normalized.includes("pro 251")) score += 3;
  if (normalized.includes("nombre docente") || (normalized.includes("docente") && normalized.includes("carrera"))) score += 1;
  if (normalized.includes("tiempo de dedicacion")) score += 1;
  const questionHits = QUESTION_DEFINITIONS.filter((definition) => definition.phrases.some((phrase) => normalized.includes(phrase))).length;
  if (questionHits >= 2) score += 2;
  else if (questionHits === 1) score += 1;
  if (normalized.includes("resumen de capacitacion") || normalized.includes("capacitacion propuesta")) score += 1;
  if (normalized.includes("impacto esperado en el docente") || normalized.includes("vision a largo plazo")) score += 1;
  return score;
}

function normalizeTraining(training, index) {
  const normalized = createTraining({ ...training, orden: training?.orden || index + 1 });
  if (!normalized.fecha_rango_original && (normalized.fecha_inicio_propuesta || normalized.fecha_fin_propuesta)) {
    normalized.fecha_rango_original = [normalized.fecha_inicio_propuesta, normalized.fecha_fin_propuesta].filter(Boolean).join(" hasta ");
  }
  return normalized;
}

function evaluateRecord(record, options = {}) {
  const output = JSON.parse(JSON.stringify(record || {}));
  output.docente = output.docente || {};
  output.diagnostico = output.diagnostico || {};
  output.capacitaciones = Array.isArray(output.capacitaciones)
    ? output.capacitaciones.map(normalizeTraining)
    : [];

  const missing = [];
  const teacherRequired = [
    ["Nombre del docente", output.docente.nombre],
    ["Carrera", output.docente.carrera],
    ["Tiempo de dedicación", output.docente.tiempo_dedicacion],
    ["Nivel académico actual", output.docente.nivel_academico_actual],
    ["Código del documento", output.docente.codigo_documento],
    ["Periodo del plan", output.docente.periodo_plan]
  ];
  teacherRequired.forEach(([label, value]) => { if (!compact(value)) missing.push(label); });
  Object.entries(DIAGNOSTIC_LABELS).forEach(([field, label]) => {
    if (!compact(output.diagnostico[field])) missing.push(label);
  });

  if (!output.capacitaciones.length) {
    missing.push("Capacitaciones propuestas");
  } else {
    output.capacitaciones.forEach((training, index) => {
      const prefix = `Capacitación ${index + 1}`;
      if (!compact(training.nombre)) missing.push(`${prefix}: nombre`);
      if (!Number(training.horas)) missing.push(`${prefix}: horas`);
      if (!compact(training.fecha_inicio_propuesta)) missing.push(`${prefix}: fecha de inicio`);
      if (!compact(training.fecha_fin_propuesta)) missing.push(`${prefix}: fecha de finalización`);
      if (!compact(training.tipo)) missing.push(`${prefix}: tipo`);
      if (!training.actividades_teoricas.length) missing.push(`${prefix}: actividades teóricas`);
      if (!training.actividades_practicas.length) missing.push(`${prefix}: actividades prácticas`);
      if (!compact(training.impacto_esperado)) missing.push(`${prefix}: impacto esperado`);
      if (!compact(training.vision_largo_plazo)) missing.push(`${prefix}: visión a largo plazo`);
    });
  }

  const found = 6 + Object.keys(DIAGNOSTIC_LABELS).length + Math.max(1, output.capacitaciones.length * 9) - missing.length;
  const total = 6 + Object.keys(DIAGNOSTIC_LABELS).length + Math.max(1, output.capacitaciones.length * 9);
  output.confianza = Math.max(0, Math.min(100, Math.round((found / total) * 100)));
  output.campos_faltantes = [...new Set(missing)];

  const isPlan = options.isPlan !== false;
  const possiblePlan = Boolean(options.possiblePlan);
  if (!isPlan && !possiblePlan) output.estado = "NO_ES_PLAN";
  else output.estado = output.campos_faltantes.length ? "REVISAR" : "COMPLETO";
  return output;
}

function parsePlanText(text, metadata = {}) {
  const source = cleanText(text);
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const answers = extractQuestionAnswers(source);
  const code = extractCode(source, metadata.fileName || "");

  const coverName = valueAfterLabel(lines, ["DOCENTE"], { stopLabels: ["CARRERA"] });
  const coverCareer = valueAfterLabel(lines, ["CARRERA"], { stopLabels: ["FIRMA", "APROBADO"] });
  const identificationName = valueAfterLabel(lines, ["Nombre Docente"], { stopLabels: ["Tiempo de Dedicación", "Carrera"] });
  const dedication = valueAfterLabel(lines, ["Tiempo de Dedicación"], { stopLabels: ["Carrera", "Función Sustantiva"] });
  const identificationCareer = valueAfterLabel(lines, ["Carrera"], { stopLabels: ["Función Sustantiva"] });

  const docente = {
    nombre: smartCase(identificationName || coverName),
    carrera: smartCase(identificationCareer || coverCareer),
    tiempo_dedicacion: smartCase(dedication),
    nivel_academico_actual: smartCase(cleanExtractedAnswer(answers.nivel_academico_actual)),
    codigo_documento: code,
    periodo_plan: extractPeriod(code)
  };

  const diagnostico = {
    capacitacion_12_meses: answers.capacitacion_12_meses || "",
    avances_aplicados: answers.avances_aplicados || "",
    comodidad_metodologias: answers.comodidad_metodologias || "",
    estrategias_pedagogicas: answers.estrategias_pedagogicas || "",
    herramientas_tecnologicas: answers.herramientas_tecnologicas || "",
    formacion_adicional: answers.formacion_adicional || "",
    tipo_formacion: answers.tipo_formacion || ""
  };

  const sharedDetails = extractSharedTrainingDetails(source);
  const capacitaciones = parseTrainings(source).map((training, _index, all) => ({
    ...training,
    ...sharedDetails,
    detalle_compartido_entre_capacitaciones: all.length > 1
  }));

  const score = planSignalScore(source);
  const possiblePlan = score >= 3 || Boolean(docente.nombre && docente.carrera && Object.values(diagnostico).filter(Boolean).length >= 2);
  const isPlan = score >= 4 || Boolean(code && docente.nombre && docente.carrera);
  const warnings = Array.isArray(metadata.warnings) ? [...metadata.warnings] : [];
  if (possiblePlan && !isPlan) warnings.push("El contenido parece un plan, pero requiere confirmación manual.");

  const record = {
    id: crypto.randomUUID(),
    archivo: {
      nombre: metadata.fileName || path.basename(metadata.filePath || "documento.pdf"),
      ruta: metadata.filePath || "",
      hash: metadata.hash || "",
      tamano: Number(metadata.size || 0),
      paginas: Number(metadata.pages || 0),
      metodo_lectura: metadata.method || "",
      fecha_procesamiento: new Date().toISOString()
    },
    docente,
    diagnostico,
    capacitaciones,
    estado: "REVISAR",
    confianza: 0,
    campos_faltantes: [],
    advertencias: warnings,
    deteccion: {
      puntaje_plan: score,
      confirmado_como_plan: isPlan,
      posible_plan: possiblePlan
    },
    correccion_manual: false,
    fecha_correccion: ""
  };

  return evaluateRecord(record, { isPlan, possiblePlan });
}

module.exports = {
  QUESTION_GROUPS,
  QUESTION_DEFINITIONS,
  cleanText,
  normalizeForMatch,
  extractQuestionAnswers,
  extractCode,
  extractPeriod,
  parseDateRange,
  parseTrainings,
  extractSharedTrainingDetails,
  planSignalScore,
  evaluateRecord,
  parsePlanText
};
