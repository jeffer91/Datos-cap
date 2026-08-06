"use strict";

const CANONICAL_CAREERS = Object.freeze([
  "Administración",
  "Contabilidad",
  "Desarrollo de Software",
  "Diseño Multimedia",
  "Educación Básica",
  "Educación Inicial",
  "Enfermería",
  "Estética Integral",
  "Gestión del Talento Humano",
  "Marketing Digital y Comercio Electrónico",
  "Mecánica Automotriz",
  "Procesamiento de Alimentos",
  "Redes y Telecomunicaciones",
  "Seguridad Ciudadana y Orden Público",
  "Seguridad y Prevención de Riesgos Laborales"
]);

const CONTAMINATION_PATTERNS = Object.freeze([
  /\b(?:resumen|indicadores?|actividades?|impacto|visi[oó]n)\s+(?:de|a|esperado)/i,
  /\bnombre\s+de\s+capacitaci[oó]n\s+propuesta/i,
  /\bhoras\s+de\s+capacitaci[oó]n/i,
  /\bfecha\s+de\s+propuesta\s+de\s+ejecuci[oó]n/i,
  /\btotal\s+de\s+horas/i,
  /\bcumplimiento\s+del\s+indicador/i,
  /\binstrumento\s+de\s+evaluaci[oó]n/i,
  /\bformaci[oó]n\s+docente\b/i
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[‐‑‒–—―￾�]/g, "-")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function levenshtein(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = old;
    }
  }
  return previous[b.length];
}

function similarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLength = Math.max(a.length, b.length);
  return maxLength ? Math.max(0, 1 - (levenshtein(a, b) / maxLength)) : 0;
}

function numericOcr(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[OQ]/g, "0")
    .replace(/[IL|]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/[^0-9]/g, "");
}

function isValidPlanCode(value) {
  const match = clean(value).match(/^UGPA-RGI([12])-(\d{2,3})-PRO-251-(20\d{2})-(0[1-9]|1[0-2])$/i);
  return Boolean(match && Number(match[2]) > 0);
}

function canonicalCode(groups) {
  const sequence = Number(numericOcr(groups?.sequence));
  const year = numericOcr(groups?.year);
  const month = Number(numericOcr(groups?.month));
  const rgi = Number(numericOcr(groups?.rgi));
  if (![1, 2].includes(rgi) || !sequence || !/^20\d{2}$/.test(year) || month < 1 || month > 12) return "";
  return `UGPA-RGI${rgi}-${String(sequence).padStart(2, "0")}-PRO-251-${year}-${String(month).padStart(2, "0")}`;
}

function codeCandidatesFromSource(value) {
  const source = clean(value).toUpperCase();
  if (!source) return [];
  const output = [];
  const add = (code) => {
    if (isValidPlanCode(code)) output.push(code);
  };

  const direct = /UGPA\s*[- ]?\s*RGI\s*([12])\s*[- ]?\s*(\d{1,3})\s*[- ]?\s*PRO\s*[- ]?\s*251\s*[- ]?\s*(20\d{2})\s*[- ]?\s*(1[0-2]|0?[1-9])/gi;
  let match;
  while ((match = direct.exec(source)) !== null) {
    add(canonicalCode({ rgi: match[1], sequence: match[2], year: match[3], month: match[4] }));
  }

  const compactSource = source
    .replace(/[‐‑‒–—―￾�]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/R[G6][I1L|]\s*([12])/g, "RGI$1")
    .replace(/PR[OQ0]\s*[- ]?\s*25[I1L|]/g, "PRO-251");
  const tolerant = /U[G6]P[A4].{0,18}RGI([12]).{0,15}([0-9OQIL|SB]{1,3}).{0,20}PRO-251.{0,15}(20[0-9OQIL|SB]{2}).{0,10}([0-9OQIL|SB]{1,2})(?=\D|$)/gi;
  while ((match = tolerant.exec(compactSource)) !== null) {
    add(canonicalCode({ rgi: match[1], sequence: match[2], year: match[3], month: match[4] }));
  }
  return output;
}

function sourceWeight(index) {
  if (index === 0) return 2;
  if (index === 1) return 1;
  if (index === 2) return 4;
  return 5;
}

function repairPlanCode(...sources) {
  const scores = new Map();
  const firstSeen = new Map();
  let order = 0;

  sources.forEach((source, index) => {
    const candidates = codeCandidatesFromSource(source);
    const occurrences = new Map();
    candidates.forEach((code) => occurrences.set(code, (occurrences.get(code) || 0) + 1));
    occurrences.forEach((count, code) => {
      const cappedCount = Math.min(index === 1 ? 3 : 1, count);
      scores.set(code, (scores.get(code) || 0) + (sourceWeight(index) * cappedCount));
      if (!firstSeen.has(code)) firstSeen.set(code, order++);
    });
  });

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || firstSeen.get(left[0]) - firstSeen.get(right[0]))
    .map(([code]) => code)[0] || "";
}

function extractPeriod(code) {
  const match = clean(code).match(/(20\d{2})-(0[1-9]|1[0-2])$/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function cleanTeacherName(value) {
  return clean(value)
    .replace(/\s+UGPA[\s\S]*$/i, "")
    .replace(/\s+(?:PRO[- ]?251[- ]?)?\d{2,4}[-/]20\d{2}[-/]\d{1,2}\s*$/i, "")
    .replace(/\s+251[- ]20\d{2}[- ](?:0?[1-9]|1[0-2])\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeCareer(value) {
  const source = clean(value);
  if (!source) return "";
  const normalizedSource = normalize(source);
  const exact = CANONICAL_CAREERS.find((career) => normalize(career) === normalizedSource);
  if (exact) return exact;

  const ranked = CANONICAL_CAREERS.map((career) => ({ career, score: similarity(source, career) }))
    .sort((left, right) => right.score - left.score);
  if (ranked[0]?.score >= 0.88) return ranked[0].career;
  return source;
}

function cleanTrainingName(value) {
  return clean(value)
    .replace(/^\d{1,2}[.)]?\s*/, "")
    .replace(/\b\d{1,4}\s*(?:h|hora|horas)\b[\s\S]*$/i, "")
    .replace(/\bDesde\b[\s\S]*$/i, "")
    .replace(/\b(?:Aprobaci[oó]n|Certificaci[oó]n|Asistencia)\b[\s\S]*$/i, "")
    .replace(/^[#*•\-:;,.\s]+|[#*•\-:;,.\s]+$/g, "")
    .trim();
}

function uniqueList(values) {
  const output = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const cleanValue = clean(value);
    const key = normalize(cleanValue);
    if (!cleanValue || !key || seen.has(key)) return;
    seen.add(key);
    output.push(cleanValue);
  });
  return output;
}

function resolveSharedDetails(record) {
  const trainings = Array.isArray(record?.capacitaciones) ? record.capacitaciones : [];
  const existing = record?.detalles_plan || {};
  const theoretical = uniqueList([
    ...(existing.actividades_teoricas || []),
    ...trainings.flatMap((training) => training.actividades_teoricas || [])
  ]);
  const practical = uniqueList([
    ...(existing.actividades_practicas || []),
    ...trainings.flatMap((training) => training.actividades_practicas || [])
  ]);
  const impact = clean(existing.impacto_esperado)
    || trainings.map((training) => clean(training.impacto_esperado)).find(Boolean)
    || "";
  const vision = clean(existing.vision_largo_plazo)
    || trainings.map((training) => clean(training.vision_largo_plazo)).find(Boolean)
    || "";
  return {
    actividades_teoricas: theoretical,
    actividades_practicas: practical,
    impacto_esperado: impact,
    vision_largo_plazo: vision
  };
}

function propagateSharedDetails(record) {
  const output = clone(record);
  const shared = resolveSharedDetails(output);
  output.detalles_plan = shared;
  output.capacitaciones = (output.capacitaciones || []).map((training, index) => ({
    ...training,
    orden: index + 1,
    nombre: cleanTrainingName(training.nombre),
    actividades_teoricas: uniqueList(training.actividades_teoricas?.length ? training.actividades_teoricas : shared.actividades_teoricas),
    actividades_practicas: uniqueList(training.actividades_practicas?.length ? training.actividades_practicas : shared.actividades_practicas),
    impacto_esperado: clean(training.impacto_esperado) || shared.impacto_esperado,
    vision_largo_plazo: clean(training.vision_largo_plazo) || shared.vision_largo_plazo,
    detalle_compartido_entre_capacitaciones: true
  }));
  return output;
}

function applyPlanIntelligence(record, context = {}) {
  let output = clone(record);
  output.docente = output.docente || {};
  output.docente.nombre = cleanTeacherName(output.docente.nombre);
  output.docente.carrera = normalizeCareer(output.docente.carrera);

  const previousCode = clean(output.docente.codigo_documento);
  const repairedCode = repairPlanCode(
    previousCode,
    context.rawText,
    context.fileName,
    ...(context.codeCandidates || [])
  );
  const manualCode = Boolean(output.correccion_manual || context.method === "CORRECCION_MANUAL");
  if (repairedCode && (!manualCode || !isValidPlanCode(previousCode))) {
    output.docente.codigo_documento = repairedCode;
    output.docente.periodo_plan = extractPeriod(repairedCode);
  } else if (isValidPlanCode(previousCode)) {
    output.docente.periodo_plan = output.docente.periodo_plan || extractPeriod(previousCode);
  }

  output = propagateSharedDetails(output);
  output.inteligencia = {
    ...(output.inteligencia || {}),
    aplicada: true,
    codigo_reparado: Boolean(repairedCode && repairedCode !== previousCode && output.docente.codigo_documento === repairedCode),
    codigo_consenso: repairedCode || "",
    lectura_posicional: context.method === "DIGITAL_POSICIONAL",
    metodo: context.method || output.archivo?.metodo_lectura || ""
  };
  return output;
}

function trainingSimilarity(left, right) {
  const leftNames = (left?.capacitaciones || []).map((item) => cleanTrainingName(item.nombre)).filter(Boolean);
  const rightNames = (right?.capacitaciones || []).map((item) => cleanTrainingName(item.nombre)).filter(Boolean);
  if (!leftNames.length || !rightNames.length) return 0;
  const scores = leftNames.map((name) => Math.max(...rightNames.map((other) => similarity(name, other))));
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function isShortAliasFile(value) {
  return /^UG[A-Z0-9]{3,8}~\d+\.PDF$/i.test(clean(value)) || /^UG[A-Z0-9]{4,10}\.PDF$/i.test(clean(value));
}

function duplicateScore(left, right) {
  const leftCode = clean(left?.docente?.codigo_documento);
  const rightCode = clean(right?.docente?.codigo_documento);
  if (isValidPlanCode(leftCode) && isValidPlanCode(rightCode)) return leftCode === rightCode ? 1 : 0;

  const leftPeriod = clean(left?.docente?.periodo_plan) || extractPeriod(leftCode);
  const rightPeriod = clean(right?.docente?.periodo_plan) || extractPeriod(rightCode);
  if (leftPeriod && rightPeriod && leftPeriod !== rightPeriod) return 0;

  const nameScore = similarity(left?.docente?.nombre, right?.docente?.nombre);
  const careerScore = similarity(normalizeCareer(left?.docente?.carrera), normalizeCareer(right?.docente?.carrera));
  const trainingScore = trainingSimilarity(left, right);
  const hasAlias = isShortAliasFile(left?.archivo?.nombre) || isShortAliasFile(right?.archivo?.nombre);
  if (hasAlias && nameScore >= 0.96 && careerScore >= 0.9 && trainingScore >= 0.72) return 0.95;
  return (nameScore * 0.5) + (careerScore * 0.2) + (trainingScore * 0.3);
}

function valueScore(value) {
  const source = clean(value);
  return source ? Math.min(20, Math.ceil(source.length / 8)) : 0;
}

function textQuality(value) {
  const source = clean(value);
  if (!source) return -1000;
  let score = Math.min(24, Math.ceil(source.length / 10));
  if (CONTAMINATION_PATTERNS.some((pattern) => pattern.test(source))) score -= 80;
  if (/\bUGPA-RGI[12]\b/i.test(source)) score -= 35;
  if (/�|￾/.test(source)) score -= 20;
  return score;
}

function recordQuality(record) {
  let score = 0;
  if (record?.correccion_manual) score += 1000;
  if (isValidPlanCode(record?.docente?.codigo_documento)) score += 120;
  if (record?.docente?.periodo_plan) score += 30;
  score += valueScore(record?.docente?.nombre) + valueScore(record?.docente?.carrera);
  score += Object.values(record?.diagnostico || {}).reduce((sum, value) => sum + Math.max(0, textQuality(value)), 0);
  score += (record?.capacitaciones || []).reduce((sum, training) => sum
    + Math.max(0, textQuality(training.nombre))
    + (Number(training.horas || 0) > 0 ? 10 : 0)
    + valueScore(training.fecha_inicio_propuesta)
    + valueScore(training.fecha_fin_propuesta)
    + valueScore(training.tipo), 0);
  score -= Object.keys(record?.problemas_campos || {}).length * 3;
  return score;
}

function chooseValue(primary, secondary, options = {}) {
  const left = clean(primary);
  const right = clean(secondary);
  if (!left) return secondary;
  if (!right || options.lockPrimary) return primary;
  const leftQuality = textQuality(left);
  const rightQuality = textQuality(right);
  if (rightQuality > leftQuality + 2) return secondary;
  return primary;
}

function trainingCompleteness(training) {
  return [
    cleanTrainingName(training?.nombre),
    Number(training?.horas || 0) > 0,
    clean(training?.fecha_inicio_propuesta),
    clean(training?.fecha_fin_propuesta),
    clean(training?.tipo)
  ].filter(Boolean).length;
}

function mergeTraining(primary, secondary, lockPrimary = false) {
  const left = clone(primary || {});
  const right = secondary || {};
  return {
    ...right,
    ...left,
    nombre: cleanTrainingName(chooseValue(left.nombre, right.nombre, { lockPrimary })),
    horas: Number(left.horas || (!lockPrimary ? right.horas : 0) || 0),
    fecha_inicio_propuesta: chooseValue(left.fecha_inicio_propuesta, right.fecha_inicio_propuesta, { lockPrimary }),
    fecha_fin_propuesta: chooseValue(left.fecha_fin_propuesta, right.fecha_fin_propuesta, { lockPrimary }),
    fecha_rango_original: chooseValue(left.fecha_rango_original, right.fecha_rango_original, { lockPrimary }),
    tipo: chooseValue(left.tipo, right.tipo, { lockPrimary }),
    actividades_teoricas: uniqueList([...(left.actividades_teoricas || []), ...(right.actividades_teoricas || [])]),
    actividades_practicas: uniqueList([...(left.actividades_practicas || []), ...(right.actividades_practicas || [])]),
    impacto_esperado: chooseValue(left.impacto_esperado, right.impacto_esperado, { lockPrimary }),
    vision_largo_plazo: chooseValue(left.vision_largo_plazo, right.vision_largo_plazo, { lockPrimary }),
    detalle_compartido_entre_capacitaciones: true
  };
}

function mergeTrainings(primaryTrainings, secondaryTrainings, lockPrimary = false) {
  const primary = clone(Array.isArray(primaryTrainings) ? primaryTrainings : []);
  const secondary = clone(Array.isArray(secondaryTrainings) ? secondaryTrainings : []);
  const used = new Set();

  const merged = primary.map((training, index) => {
    let bestIndex = -1;
    let bestScore = 0;
    secondary.forEach((candidate, candidateIndex) => {
      if (used.has(candidateIndex)) return;
      const nameScore = similarity(cleanTrainingName(training.nombre), cleanTrainingName(candidate.nombre));
      const orderScore = Number(training.orden || index + 1) === Number(candidate.orden || candidateIndex + 1) ? 0.18 : 0;
      const score = nameScore + orderScore;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    });
    if (bestIndex < 0 || bestScore < 0.55) return training;
    used.add(bestIndex);
    return mergeTraining(training, secondary[bestIndex], lockPrimary);
  });

  secondary.forEach((training, index) => {
    if (used.has(index)) return;
    const duplicate = merged.some((current) => similarity(cleanTrainingName(current.nombre), cleanTrainingName(training.nombre)) >= 0.82);
    if (!duplicate && trainingCompleteness(training) >= 2) merged.push(training);
  });

  return merged.map((training, index) => ({ ...training, orden: index + 1 }));
}

function mergePlanRecords(left, right) {
  const primary = recordQuality(left) >= recordQuality(right) ? clone(left) : clone(right);
  const secondary = primary.id === left.id ? right : left;
  const lockPrimary = Boolean(primary.correccion_manual);
  primary.docente = primary.docente || {};
  primary.diagnostico = primary.diagnostico || {};

  Object.keys(secondary?.docente || {}).forEach((field) => {
    if (field === "codigo_documento") {
      if (!isValidPlanCode(primary.docente[field]) && isValidPlanCode(secondary.docente[field])) primary.docente[field] = secondary.docente[field];
    } else {
      primary.docente[field] = chooseValue(primary.docente[field], secondary.docente[field], { lockPrimary });
    }
  });
  primary.docente.periodo_plan = primary.docente.periodo_plan || extractPeriod(primary.docente.codigo_documento) || secondary?.docente?.periodo_plan || "";

  Object.keys(secondary?.diagnostico || {}).forEach((field) => {
    primary.diagnostico[field] = chooseValue(primary.diagnostico[field], secondary.diagnostico[field], { lockPrimary });
  });

  primary.capacitaciones = mergeTrainings(primary.capacitaciones, secondary?.capacitaciones, lockPrimary);
  primary.detalles_plan = {
    actividades_teoricas: uniqueList([
      ...(primary.detalles_plan?.actividades_teoricas || []),
      ...(secondary?.detalles_plan?.actividades_teoricas || [])
    ]),
    actividades_practicas: uniqueList([
      ...(primary.detalles_plan?.actividades_practicas || []),
      ...(secondary?.detalles_plan?.actividades_practicas || [])
    ]),
    impacto_esperado: chooseValue(primary.detalles_plan?.impacto_esperado, secondary?.detalles_plan?.impacto_esperado, { lockPrimary }),
    vision_largo_plazo: chooseValue(primary.detalles_plan?.vision_largo_plazo, secondary?.detalles_plan?.vision_largo_plazo, { lockPrimary })
  };

  const files = [
    ...(primary.archivos_relacionados || []),
    ...(secondary?.archivos_relacionados || []),
    primary.archivo,
    secondary?.archivo
  ].filter(Boolean);
  const seenFiles = new Set();
  primary.archivos_relacionados = files.filter((file) => {
    const key = clean(file.hash) || normalize(file.ruta) || normalize(file.nombre);
    if (!key || seenFiles.has(key)) return false;
    seenFiles.add(key);
    return true;
  });

  if (secondary?.archivo?.fecha_procesamiento > primary?.archivo?.fecha_procesamiento) primary.archivo = clone(secondary.archivo);
  primary.advertencias = [...new Set([...(primary.advertencias || []), ...(secondary?.advertencias || []), "Se consolidó un registro duplicado del mismo plan."])];
  primary.deteccion = {
    ...(secondary?.deteccion || {}),
    ...(primary.deteccion || {}),
    consolidado_duplicado: true
  };
  primary.correccion_manual = Boolean(primary.correccion_manual || secondary?.correccion_manual);
  primary.fecha_correccion = primary.fecha_correccion || secondary?.fecha_correccion || "";
  return propagateSharedDetails(primary);
}

module.exports = {
  CANONICAL_CAREERS,
  CONTAMINATION_PATTERNS,
  clean,
  normalize,
  similarity,
  isValidPlanCode,
  codeCandidatesFromSource,
  repairPlanCode,
  extractPeriod,
  cleanTeacherName,
  normalizeCareer,
  cleanTrainingName,
  resolveSharedDetails,
  propagateSharedDetails,
  applyPlanIntelligence,
  trainingSimilarity,
  isShortAliasFile,
  duplicateScore,
  textQuality,
  recordQuality,
  chooseValue,
  mergeTraining,
  mergeTrainings,
  mergePlanRecords
};
