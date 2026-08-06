"use strict";

const {
  cleanTeacherName,
  normalizeCareer,
  cleanTrainingName,
  resolveSharedDetails,
  propagateSharedDetails,
  textQuality
} = require("./plan-intelligence");
const { isValidPlanCode } = require("./header-code-engine");

const ENGINE_WEIGHTS = Object.freeze({
  MANUAL: 12,
  ENCABEZADO: 8,
  TABLA_TEXTUAL: 7,
  DIGITAL_LINEAL: 6,
  DIGITAL_POSICIONAL: 6,
  OCR_ESTRUCTURADO: 5,
  OCR: 4,
  IA_LOCAL: 3
});

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000\ufffe\uffff\ufffd]/g, "-")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
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

function engineWeight(engine) {
  const key = String(engine || "").toUpperCase();
  const exact = ENGINE_WEIGHTS[key];
  if (exact) return exact;
  const partial = Object.entries(ENGINE_WEIGHTS).find(([name]) => key.includes(name));
  return partial?.[1] || 2;
}

function pathValue(record, path) {
  return String(path || "").split(".").reduce((current, key) => current?.[key], record);
}

function setPath(record, path, value) {
  const parts = String(path || "").split(".");
  let current = record;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) current[part] = value;
    else {
      current[part] = current[part] || {};
      current = current[part];
    }
  });
}

function fieldQuality(path, value) {
  const source = clean(value);
  if (!source) return -1000;
  if (path === "docente.codigo_documento") return isValidPlanCode(source) ? 80 : -80;
  if (path === "docente.periodo_plan") return /^20\d{2}-(?:0[1-9]|1[0-2])$/.test(source) ? 40 : -40;
  if (path === "docente.nombre") {
    const cleaned = cleanTeacherName(source);
    return cleaned && cleaned.length <= 140 ? 25 + Math.min(10, cleaned.split(/\s+/).length) : -50;
  }
  if (path === "docente.carrera") return normalizeCareer(source) ? 25 : -30;
  return textQuality(source);
}

function chooseScalar(candidates, path, transform = (value) => clean(value)) {
  const groups = new Map();
  const evidence = [];
  candidates.forEach((candidate, index) => {
    const raw = pathValue(candidate.record, path);
    const value = transform(raw);
    if (!clean(value)) return;
    const key = normalize(value);
    if (!key) return;
    const weight = engineWeight(candidate.engine);
    const quality = fieldQuality(path, value);
    const points = Math.max(0.1, weight + Math.max(-4, Math.min(8, quality / 10)));
    if (!groups.has(key)) groups.set(key, { value, points: 0, engines: [], firstIndex: index });
    const group = groups.get(key);
    group.points += points;
    group.engines.push(candidate.engine);
    if (fieldQuality(path, value) > fieldQuality(path, group.value)) group.value = value;
    evidence.push({ engine: candidate.engine, value, points: Math.round(points * 10) / 10 });
  });

  const ranked = [...groups.values()].sort((left, right) => right.points - left.points || left.firstIndex - right.firstIndex);
  const selected = ranked[0] || null;
  const totalPoints = ranked.reduce((sum, item) => sum + item.points, 0);
  const confidence = selected
    ? Math.min(100, Math.round(55 + (selected.points / Math.max(1, totalPoints)) * 35 + Math.min(10, selected.engines.length * 3)))
    : 0;
  return {
    value: selected?.value || "",
    confidence,
    engines: [...new Set(selected?.engines || [])],
    candidates: evidence
  };
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

function trainingSetScore(candidate) {
  const rows = Array.isArray(candidate?.record?.capacitaciones) ? candidate.record.capacitaciones : [];
  const countBonus = rows.length * 20;
  const completeness = rows.reduce((sum, row) => sum + trainingCompleteness(row) * 5, 0);
  const engineBonus = engineWeight(candidate.engine) * 2;
  return countBonus + completeness + engineBonus;
}

function chooseTrainingBase(candidates) {
  return [...candidates]
    .filter((candidate) => Array.isArray(candidate?.record?.capacitaciones) && candidate.record.capacitaciones.length)
    .sort((left, right) => trainingSetScore(right) - trainingSetScore(left))[0] || null;
}

function trainingSimilarity(left, right) {
  const a = new Set(normalize(cleanTrainingName(left?.nombre)).split(" ").filter((item) => item.length > 2));
  const b = new Set(normalize(cleanTrainingName(right?.nombre)).split(" ").filter((item) => item.length > 2));
  if (!a.size || !b.size) return 0;
  let common = 0;
  a.forEach((token) => { if (b.has(token)) common += 1; });
  return common / Math.max(a.size, b.size);
}

function chooseTrainingField(matches, field, fallback) {
  const values = matches.map((match) => ({
    engine: match.engine,
    value: field === "horas" ? Number(match.training?.[field] || 0) : clean(match.training?.[field])
  })).filter((item) => field === "horas" ? item.value > 0 : Boolean(item.value));
  if (!values.length) return fallback;
  const groups = new Map();
  values.forEach((item) => {
    const key = field === "horas" ? String(item.value) : normalize(item.value);
    if (!groups.has(key)) groups.set(key, { value: item.value, points: 0, engines: [] });
    const group = groups.get(key);
    group.points += engineWeight(item.engine);
    group.engines.push(item.engine);
  });
  return [...groups.values()].sort((left, right) => right.points - left.points)[0].value;
}

function mergeTrainingRows(candidates) {
  const baseCandidate = chooseTrainingBase(candidates);
  if (!baseCandidate) return { rows: [], evidence: [] };
  const baseRows = clone(baseCandidate.record.capacitaciones || []);
  const used = new Map(candidates.map((candidate) => [candidate.engine, new Set()]));
  const evidence = [];

  const rows = baseRows.map((baseRow, index) => {
    const matches = [{ engine: baseCandidate.engine, training: baseRow, index }];
    used.get(baseCandidate.engine)?.add(index);
    candidates.forEach((candidate) => {
      if (candidate === baseCandidate) return;
      const rowsCandidate = candidate.record?.capacitaciones || [];
      let bestIndex = -1;
      let bestScore = 0;
      rowsCandidate.forEach((row, rowIndex) => {
        if (used.get(candidate.engine)?.has(rowIndex)) return;
        const orderMatch = Number(row?.orden || rowIndex + 1) === Number(baseRow?.orden || index + 1) ? 0.35 : 0;
        const nameMatch = trainingSimilarity(baseRow, row);
        const score = orderMatch + nameMatch;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = rowIndex;
        }
      });
      if (bestIndex >= 0 && bestScore >= 0.35) {
        used.get(candidate.engine)?.add(bestIndex);
        matches.push({ engine: candidate.engine, training: rowsCandidate[bestIndex], index: bestIndex });
      }
    });

    const merged = {
      ...clone(baseRow),
      orden: index + 1,
      nombre: cleanTrainingName(chooseTrainingField(matches, "nombre", baseRow.nombre)),
      horas: Number(chooseTrainingField(matches, "horas", baseRow.horas) || 0),
      fecha_inicio_propuesta: chooseTrainingField(matches, "fecha_inicio_propuesta", baseRow.fecha_inicio_propuesta),
      fecha_fin_propuesta: chooseTrainingField(matches, "fecha_fin_propuesta", baseRow.fecha_fin_propuesta),
      tipo: chooseTrainingField(matches, "tipo", baseRow.tipo),
      detalle_compartido_entre_capacitaciones: true
    };
    merged.fecha_rango_original = [merged.fecha_inicio_propuesta, merged.fecha_fin_propuesta].filter(Boolean).join(" hasta ");
    evidence.push({ order: index + 1, engines: matches.map((item) => item.engine) });
    return merged;
  });

  candidates.forEach((candidate) => {
    (candidate.record?.capacitaciones || []).forEach((row, index) => {
      if (used.get(candidate.engine)?.has(index)) return;
      if (trainingCompleteness(row) < 4) return;
      const duplicate = rows.some((current) => trainingSimilarity(current, row) >= 0.65);
      if (!duplicate) {
        rows.push({ ...clone(row), orden: rows.length + 1, detalle_compartido_entre_capacitaciones: true });
        evidence.push({ order: rows.length, engines: [candidate.engine] });
      }
    });
  });

  return { rows, evidence };
}

function chooseList(candidates, getter) {
  const values = [];
  const seen = new Set();
  candidates.forEach((candidate) => {
    const source = getter(candidate.record);
    (Array.isArray(source) ? source : []).forEach((value) => {
      const cleanValue = clean(value);
      const key = normalize(cleanValue);
      if (!cleanValue || !key || seen.has(key)) return;
      seen.add(key);
      values.push(cleanValue);
    });
  });
  return values;
}

function bestText(candidates, getter) {
  return candidates.map((candidate) => ({
    value: clean(getter(candidate.record)),
    points: engineWeight(candidate.engine) + Math.max(-5, Math.min(12, textQuality(getter(candidate.record)) / 5)),
    engine: candidate.engine
  })).filter((item) => item.value)
    .sort((left, right) => right.points - left.points || right.value.length - left.value.length)[0]?.value || "";
}

function consensusPlanRecords(candidates, options = {}) {
  const usable = (Array.isArray(candidates) ? candidates : []).filter((candidate) => candidate?.record);
  if (!usable.length) throw new Error("No existen resultados de motores para consolidar.");
  const primary = clone(usable.sort((left, right) => engineWeight(right.engine) - engineWeight(left.engine))[0].record);
  primary.docente = primary.docente || {};
  primary.diagnostico = primary.diagnostico || {};
  const evidence = {};

  const scalarFields = [
    ["docente.nombre", cleanTeacherName],
    ["docente.carrera", normalizeCareer],
    ["docente.nivel_academico_actual", clean],
    ["diagnostico.capacitacion_12_meses", clean],
    ["diagnostico.avances_aplicados", clean],
    ["diagnostico.comodidad_metodologias", clean],
    ["diagnostico.estrategias_pedagogicas", clean],
    ["diagnostico.herramientas_tecnologicas", clean],
    ["diagnostico.formacion_adicional", clean],
    ["diagnostico.tipo_formacion", clean]
  ];
  scalarFields.forEach(([path, transform]) => {
    const selected = chooseScalar(usable, path, transform);
    if (selected.value) setPath(primary, path, selected.value);
    evidence[path] = selected;
  });

  const codeResult = options.codeResult || {};
  if (codeResult.code) {
    primary.docente.codigo_documento = codeResult.code;
    primary.docente.periodo_plan = codeResult.period;
    evidence["docente.codigo_documento"] = {
      value: codeResult.code,
      confidence: codeResult.confidence,
      engines: (codeResult.candidates?.[0]?.engines || []).map((item) => item.engine),
      candidates: codeResult.candidates || []
    };
  } else {
    const code = chooseScalar(usable, "docente.codigo_documento", clean);
    const period = chooseScalar(usable, "docente.periodo_plan", clean);
    primary.docente.codigo_documento = code.value;
    primary.docente.periodo_plan = period.value;
    evidence["docente.codigo_documento"] = code;
    evidence["docente.periodo_plan"] = period;
  }
  primary.docente.tiempo_dedicacion = "Tiempo Completo";

  const mergedTrainings = mergeTrainingRows(usable);
  primary.capacitaciones = mergedTrainings.rows;
  evidence.capacitaciones = {
    confidence: primary.capacitaciones.length ? Math.min(100, 65 + mergedTrainings.evidence.reduce((sum, item) => sum + item.engines.length * 5, 0)) : 0,
    rows: mergedTrainings.evidence
  };

  const detailsByCandidate = usable.map((candidate) => ({ ...candidate, details: resolveSharedDetails(candidate.record) }));
  primary.detalles_plan = {
    actividades_teoricas: chooseList(detailsByCandidate, (record) => resolveSharedDetails(record).actividades_teoricas),
    actividades_practicas: chooseList(detailsByCandidate, (record) => resolveSharedDetails(record).actividades_practicas),
    impacto_esperado: bestText(usable, (record) => resolveSharedDetails(record).impacto_esperado),
    vision_largo_plazo: bestText(usable, (record) => resolveSharedDetails(record).vision_largo_plazo)
  };

  primary.evidencias_campos = evidence;
  primary.motores = usable.map((candidate) => ({
    nombre: candidate.engine,
    metodo: candidate.reading?.method || candidate.engine,
    problemas: Object.keys(candidate.record?.problemas_campos || {}).length,
    capacitaciones: candidate.record?.capacitaciones?.length || 0
  }));
  primary.deteccion = {
    ...(primary.deteccion || {}),
    plantilla: codeResult.template || primary.deteccion?.plantilla || "DESCONOCIDA",
    consenso_multimotor: true,
    motores_ejecutados: usable.map((candidate) => candidate.engine)
  };
  primary.advertencias = [...new Set([
    ...(primary.advertencias || []),
    usable.length > 1 ? `Se compararon ${usable.length} motores independientes y se eligió cada campo por consenso.` : ""
  ].filter(Boolean))];
  return propagateSharedDetails(primary);
}

module.exports = {
  ENGINE_WEIGHTS,
  engineWeight,
  pathValue,
  setPath,
  chooseScalar,
  trainingCompleteness,
  trainingSetScore,
  mergeTrainingRows,
  consensusPlanRecords
};