"use strict";

const path = require("path");
const crypto = require("crypto");

const QUESTION_GROUPS = Object.freeze({
  capacitacion_12_meses: [
    "en que curso o programa de actualizacion has participado en los ultimos 12 meses",
    "has participado recientemente en algun curso o programa de actualizacion en tu area de ensenanza"
  ],
  avances_aplicados: [
    "podrias mencionar uno o mas avances recientes en tu campo disciplinar que hayas aplicado en tus clases",
    "consideras que tienes suficientes conocimientos sobre las ultimas investigaciones o avances en tu disciplina"
  ],
  comodidad_metodologias: [
    "que tan comodo a te sientes implementando nuevas metodologias de ensenanza en el aula",
    "que tan comodo te sientes implementando nuevas metodologias de ensenanza en el aula"
  ],
  estrategias_pedagogicas: [
    "que estrategias pedagogicas innovadoras aplicas en tu practica docente",
    "conoces y aplicas estrategias pedagogicas innovadoras"
  ],
  herramientas_tecnologicas: [
    "que herramientas tecnologicas utilizas regularmente en tu docencia",
    "tienes experiencia en la utilizacion de plataformas virtuales o tecnologia educativa"
  ],
  formacion_adicional: [
    "que formacion academica adicional consideras necesaria para fortalecer tu perfil profesional"
  ],
  nivel_academico_actual: [
    "cual es tu nivel academico actual"
  ],
  tipo_formacion: [
    "la formacion academica que propones es especifica o generica"
  ]
});

const ALL_QUESTION_PHRASES = Object.values(QUESTION_GROUPS).flat();
const STATUS_TYPES = [
  "APROBACIÓN", "APROBACION", "CERTIFICACIÓN", "CERTIFICACION",
  "ASISTENCIA", "CURSO", "TALLER", "SEMINARIO", "CONGRESO",
  "DIPLOMADO", "CAPACITACIÓN", "CAPACITACION"
];

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
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 4); cursor += 1) {
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

function findQuestionAnswer(lines, phrases) {
  const normalizedPhrases = phrases.map(normalizeForMatch);
  for (let index = 0; index < lines.length; index += 1) {
    let joinedQuestion = "";
    let questionEnd = index;
    let found = false;

    for (let cursor = index; cursor < Math.min(lines.length, index + 7); cursor += 1) {
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
      answer.push(line.replace(/^[•▪◦●■□◆◇▶►\-–—]+\s*/, ""));
    }
    return compact(answer.join(" "));
  }
  return "";
}

function isQuestionStart(line) {
  const normalized = normalizeForMatch(line);
  return /^[•▪◦●■□◆◇▶►\-–—]*\s*[¿?]/.test(line.trim())
    || ALL_QUESTION_PHRASES.some((phrase) => normalized.includes(phrase));
}

function isMajorSection(line) {
  const normalized = normalizeForMatch(line);
  return /^\d+(?:\.\d+)*[.)]?\s+/.test(line.trim())
    || [
      "evaluaciones de capacitacion", "resumen de capacitacion propuestas",
      "indicadores", "actividades", "formacion docente"
    ].some((heading) => normalized === heading || normalized.startsWith(`${heading} `));
}

function extractCode(text) {
  const source = compact(text)
    .replace(/PRO\s*[- ]?\s*251/gi, "PRO-251")
    .replace(/RGI\s*([12])/gi, "RGI$1");
  const strict = source.match(/UGPA\s*-?\s*RGI([12])\s*-?\s*(\d{1,3})\s*-?\s*PRO-251\s*-?\s*(20\d{2})\s*-?\s*(0?[1-9]|1[0-2])/i);
  if (strict) return `UGPA-RGI${strict[1]}-${String(strict[2]).padStart(2, "0")}-PRO-251-${strict[3]}-${String(strict[4]).padStart(2, "0")}`;
  const loose = source.match(/UGPA.{0,8}RGI([12]).{0,8}(\d{1,3}).{0,12}PRO.{0,5}251.{0,8}(20\d{2}).{0,5}(0?[1-9]|1[0-2])/i);
  if (loose) return `UGPA-RGI${loose[1]}-${String(loose[2]).padStart(2, "0")}-PRO-251-${loose[3]}-${String(loose[4]).padStart(2, "0")}`;
  return "";
}

function extractPeriod(code) {
  const match = String(code || "").match(/(20\d{2})-(0[1-9]|1[0-2])$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function getSection(text, startLabels, endLabels) {
  const source = cleanText(text);
  const normalized = normalizeForMatch(source);
  let startIndex = -1;
  let matchedLength = 0;
  for (const label of startLabels) {
    const cleanLabel = normalizeForMatch(label);
    const index = normalized.indexOf(cleanLabel);
    if (index >= 0 && (startIndex < 0 || index < startIndex)) {
      startIndex = index;
      matchedLength = cleanLabel.length;
    }
  }
  if (startIndex < 0) return "";

  // La normalización conserva el orden, pero no los índices exactos. Se localiza de nuevo
  // con una expresión flexible en el texto original para mantener los valores sin alterar.
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function parseTrainings(text) {
  const section = getSection(
    text,
    ["Resumen de Capacitación Propuestas", "Resumen de Capacitacion Propuestas"],
    ["5. Indicadores", "Indicadores"]
  );
  if (!section) return [];
  const source = removeTrainingHeaders(section);
  const typePattern = STATUS_TYPES.map(escapeRegExp).join("|");
  const expression = new RegExp(
    `(?:^|\\s)(\\d{1,2})\\s+(.+?)\\s+(\\d{1,4})\\s+(Desde\\s+.+?)\\s+(${typePattern})(?=\\s+\\d{1,2}\\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]|$)`,
    "gi"
  );
  const trainings = [];
  let match;
  while ((match = expression.exec(source)) !== null) {
    const range = parseDateRange(match[4]);
    trainings.push({
      orden: Number(match[1]),
      nombre: smartCase(match[2]),
      horas: Number(match[3]),
      fecha_inicio_propuesta: range.inicio,
      fecha_fin_propuesta: range.fin,
      fecha_rango_original: range.original,
      tipo: smartCase(match[5]),
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: "",
      detalle_compartido_entre_capacitaciones: false
    });
  }
  return trainings;
}

function parseActivityList(section) {
  const lines = cleanText(section).split("\n").map((line) => line.trim()).filter(Boolean);
  const values = [];
  for (const line of lines) {
    const clean = line.replace(/^[•▪◦●■□◆◇▶►\-–—]+\s*/, "").trim();
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

function parsePlanText(text, metadata = {}) {
  const source = cleanText(text);
  const lines = source.split("\n").map((line) => line.trim()).filter(Boolean);
  const normalizedSource = normalizeForMatch(source);
  const isPlan = normalizedSource.includes("plan individual de formacion y capacitacion")
    && normalizedSource.includes("pro 251");

  const code = extractCode(source);
  const coverName = valueAfterLabel(lines, ["DOCENTE"], { stopLabels: ["CARRERA"] });
  const coverCareer = valueAfterLabel(lines, ["CARRERA"], { stopLabels: ["FIRMA", "APROBADO"] });
  const identificationName = valueAfterLabel(lines, ["Nombre Docente"], { stopLabels: ["Tiempo de Dedicación", "Carrera"] });
  const dedication = valueAfterLabel(lines, ["Tiempo de Dedicación"], { stopLabels: ["Carrera", "Función Sustantiva"] });
  const identificationCareer = valueAfterLabel(lines, ["Carrera"], { stopLabels: ["Función Sustantiva"] });

  const diagnostico = {
    capacitacion_12_meses: findQuestionAnswer(lines, QUESTION_GROUPS.capacitacion_12_meses),
    avances_aplicados: findQuestionAnswer(lines, QUESTION_GROUPS.avances_aplicados),
    comodidad_metodologias: findQuestionAnswer(lines, QUESTION_GROUPS.comodidad_metodologias),
    estrategias_pedagogicas: findQuestionAnswer(lines, QUESTION_GROUPS.estrategias_pedagogicas),
    herramientas_tecnologicas: findQuestionAnswer(lines, QUESTION_GROUPS.herramientas_tecnologicas),
    formacion_adicional: findQuestionAnswer(lines, QUESTION_GROUPS.formacion_adicional),
    tipo_formacion: findQuestionAnswer(lines, QUESTION_GROUPS.tipo_formacion)
  };

  const docente = {
    nombre: smartCase(identificationName || coverName),
    carrera: smartCase(identificationCareer || coverCareer),
    tiempo_dedicacion: smartCase(dedication),
    nivel_academico_actual: smartCase(findQuestionAnswer(lines, QUESTION_GROUPS.nivel_academico_actual)),
    codigo_documento: code,
    periodo_plan: extractPeriod(code)
  };

  const sharedDetails = extractSharedTrainingDetails(source);
  const capacitaciones = parseTrainings(source).map((training, _index, all) => ({
    ...training,
    ...sharedDetails,
    detalle_compartido_entre_capacitaciones: all.length > 1
  }));

  const required = {
    "Nombre del docente": docente.nombre,
    Carrera: docente.carrera,
    "Tiempo de dedicación": docente.tiempo_dedicacion,
    "Código del documento": docente.codigo_documento,
    "Periodo del plan": docente.periodo_plan,
    "Nivel académico actual": docente.nivel_academico_actual,
    "Capacitaciones propuestas": capacitaciones.length ? "sí" : ""
  };
  const camposFaltantes = Object.entries(required).filter(([, value]) => !value).map(([label]) => label);
  const diagnosticValues = Object.values(diagnostico);
  const foundCount = Object.values(required).filter(Boolean).length + diagnosticValues.filter(Boolean).length;
  const totalCount = Object.keys(required).length + diagnosticValues.length;
  const confianza = Math.round((foundCount / totalCount) * 100);

  return {
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
    estado: !isPlan ? "NO_ES_PLAN" : camposFaltantes.length ? "REVISAR" : "COMPLETO",
    confianza,
    campos_faltantes: !isPlan ? ["El PDF no corresponde a un Plan Individual PRO-251"] : camposFaltantes,
    advertencias: Array.isArray(metadata.warnings) ? metadata.warnings : []
  };
}

module.exports = {
  QUESTION_GROUPS,
  cleanText,
  normalizeForMatch,
  extractCode,
  extractPeriod,
  parseDateRange,
  parseTrainings,
  extractSharedTrainingDetails,
  parsePlanText
};
