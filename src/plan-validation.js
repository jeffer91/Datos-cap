"use strict";

const {
  resolveSharedDetails,
  isValidPlanCode
} = require("./plan-intelligence");

const DEFAULT_DEDICATION = "Tiempo Completo";

const VALID_TRAINING_TYPES = new Set([
  "aprobacion", "certificacion", "asistencia", "curso", "taller",
  "seminario", "congreso", "diplomado", "capacitacion"
]);

const MIXED_CONTENT_PATTERNS = [
  /\b(?:3|4|5|6|7|8)\.?\s*(?:evaluaciones?|resumen|indicadores?|actividades?|impacto|visi[oó]n)\b/i,
  /\bresumen\s+de\s+capacitaci[oó]n/i,
  /\bnombre\s+de\s+capacitaci[oó]n\s+propuesta/i,
  /\bhoras\s+de\s+capacitaci[oó]n/i,
  /\bfecha\s+de\s+propuesta\s+de\s+ejecuci[oó]n/i,
  /\btotal\s+de\s+horas/i,
  /\bcumplimiento\s+del\s+indicador/i,
  /\bporcentaje\s+de\s+capacitaciones/i,
  /\binstrumento\s+de\s+evaluaci[oó]n/i,
  /\bformaci[oó]n\s+docente\b/i
];

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
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

function list(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function hasMixedContent(value, maxLength = 700) {
  const source = clean(value);
  if (!source) return false;
  if (source.length > maxLength) return true;
  return MIXED_CONTENT_PATTERNS.some((pattern) => pattern.test(source));
}

function addProblem(problems, path, label, message, type = "missing") {
  if (!problems[path]) problems[path] = { path, label, message, type };
}

function validateRequiredText(problems, path, label, value, options = {}) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `Falta completar: ${label}.`, "missing");
    return;
  }
  if (options.maxLength && source.length > options.maxLength) {
    addProblem(problems, path, label, `${label} parece contener texto mezclado.`, "invalid");
    return;
  }
  if (options.detectMixed && hasMixedContent(source, options.maxLength || 700)) {
    addProblem(problems, path, label, `${label} parece contener texto de otra sección.`, "invalid");
  }
}

function validateCode(problems, code) {
  const source = clean(code);
  if (!source) {
    addProblem(problems, "docente.codigo_documento", "Código del documento", "Falta completar: Código del documento.", "missing");
    return;
  }
  if (!isValidPlanCode(source)) {
    addProblem(
      problems,
      "docente.codigo_documento",
      "Código del documento",
      /-00-PRO-251/i.test(source)
        ? "El consecutivo 00 del código es sospechoso; verifica el PDF."
        : "El código no tiene el formato esperado de un Plan PRO-251.",
      "invalid"
    );
  }
}

function validatePeriod(problems, period, code) {
  const source = clean(period);
  if (!source) {
    addProblem(problems, "docente.periodo_plan", "Periodo del plan", "Falta completar: Periodo del plan.", "missing");
    return;
  }
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(source)) {
    addProblem(problems, "docente.periodo_plan", "Periodo del plan", "El periodo debe tener el formato AAAA-MM.", "invalid");
    return;
  }
  const codePeriod = clean(code).match(/(20\d{2}-(?:0[1-9]|1[0-2]))$/)?.[1] || "";
  if (codePeriod && codePeriod !== source) {
    addProblem(problems, "docente.periodo_plan", "Periodo del plan", "El periodo no coincide con el código del documento.", "invalid");
  }
}

function validateTrainingName(problems, path, label, value) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `Falta completar: ${label}.`, "missing");
    return;
  }
  if (
    source.length > 180
    || /\b(?:desde|hasta|aprobaci[oó]n|horas?|fecha|propuesta\s+de\s+ejecuci[oó]n)\b/i.test(source)
    || hasMixedContent(source, 180)
  ) {
    addProblem(problems, path, label, `${label} parece mezclar nombre, horas o fechas.`, "invalid");
  }
}

function validateHours(problems, path, label, value) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    addProblem(problems, path, label, `Falta completar: ${label}.`, "missing");
  } else if (hours > 1000) {
    addProblem(problems, path, label, `${label} parece incorrecto; revisa el número extraído.`, "invalid");
  }
}

function validateDateText(problems, path, label, value) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `Falta completar: ${label}.`, "missing");
    return;
  }
  if (source.length > 120 || hasMixedContent(source, 120) || /\b(?:aprobaci[oó]n|horas?\s+de\s+capacitaci[oó]n)\b/i.test(source)) {
    addProblem(problems, path, label, `${label} parece contener información de otra columna.`, "invalid");
  }
}

function validateTrainingType(problems, path, label, value) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `Falta completar: ${label}.`, "missing");
    return;
  }
  const normalized = normalize(source);
  if (source.length > 50 || hasMixedContent(source, 50) || ![...VALID_TRAINING_TYPES].some((type) => normalized.includes(type))) {
    addProblem(problems, path, label, `${label} no coincide con un tipo de capacitación reconocido.`, "invalid");
  }
}

function validateActivityList(problems, path, label, value) {
  const values = list(value);
  if (!values.length) {
    addProblem(problems, path, label, `Falta completar: ${label}.`, "missing");
    return;
  }
  const joined = values.join(" · ");
  if (hasMixedContent(joined, 1200)) {
    addProblem(problems, path, label, `${label} parece contener partes de otras secciones.`, "invalid");
  }
}

function validatePlanRecord(record, options = {}) {
  const output = clone(record);
  output.docente = output.docente || {};
  output.diagnostico = output.diagnostico || {};
  output.capacitaciones = Array.isArray(output.capacitaciones) ? output.capacitaciones : [];
  output.docente.tiempo_dedicacion = DEFAULT_DEDICATION;

  if (output.estado === "ERROR" && options.preserveError !== false) {
    output.problemas_campos = output.problemas_campos || {};
    return output;
  }

  const problems = {};

  validateRequiredText(problems, "docente.nombre", "Nombre del docente", output.docente.nombre, { maxLength: 140, detectMixed: true });
  validateRequiredText(problems, "docente.carrera", "Carrera", output.docente.carrera, { maxLength: 140, detectMixed: true });
  validateRequiredText(problems, "docente.nivel_academico_actual", "Nivel académico actual", output.docente.nivel_academico_actual, { maxLength: 180, detectMixed: true });
  validateCode(problems, output.docente.codigo_documento);
  validatePeriod(problems, output.docente.periodo_plan, output.docente.codigo_documento);

  const diagnosticLabels = {
    capacitacion_12_meses: "Capacitación realizada en los últimos 12 meses",
    avances_aplicados: "Avances disciplinares aplicados en clases",
    comodidad_metodologias: "Nivel de comodidad con nuevas metodologías",
    estrategias_pedagogicas: "Estrategias pedagógicas utilizadas",
    herramientas_tecnologicas: "Herramientas tecnológicas utilizadas",
    formacion_adicional: "Formación académica adicional necesaria",
    tipo_formacion: "Tipo de formación requerida"
  };

  Object.entries(diagnosticLabels).forEach(([field, label]) => {
    validateRequiredText(
      problems,
      `diagnostico.${field}`,
      label,
      output.diagnostico[field],
      { maxLength: field === "tipo_formacion" ? 300 : 700, detectMixed: true }
    );
  });

  if (!output.capacitaciones.length) {
    addProblem(problems, "capacitaciones", "Capacitaciones propuestas", "No se encontraron capacitaciones propuestas.", "missing");
  } else {
    output.capacitaciones.forEach((training, index) => {
      const number = index + 1;
      const base = `capacitaciones.${index}`;
      const prefix = `Capacitación ${number}`;
      training.orden = number;
      training.actividades_teoricas = list(training.actividades_teoricas);
      training.actividades_practicas = list(training.actividades_practicas);

      validateTrainingName(problems, `${base}.nombre`, `${prefix}: nombre`, training.nombre);
      validateHours(problems, `${base}.horas`, `${prefix}: horas`, training.horas);
      validateDateText(problems, `${base}.fecha_inicio_propuesta`, `${prefix}: fecha de inicio`, training.fecha_inicio_propuesta);
      validateDateText(problems, `${base}.fecha_fin_propuesta`, `${prefix}: fecha de finalización`, training.fecha_fin_propuesta);
      validateTrainingType(problems, `${base}.tipo`, `${prefix}: tipo`, training.tipo);
    });
  }

  const shared = resolveSharedDetails(output);
  output.detalles_plan = shared;
  const sharedBase = output.capacitaciones.length ? "capacitaciones.0" : "detalles_plan";
  validateActivityList(problems, `${sharedBase}.actividades_teoricas`, "Actividades teóricas del plan", shared.actividades_teoricas);
  validateActivityList(problems, `${sharedBase}.actividades_practicas`, "Actividades prácticas del plan", shared.actividades_practicas);
  validateRequiredText(problems, `${sharedBase}.impacto_esperado`, "Impacto esperado del plan", shared.impacto_esperado, { maxLength: 1200, detectMixed: true });
  validateRequiredText(problems, `${sharedBase}.vision_largo_plazo`, "Visión a largo plazo del plan", shared.vision_largo_plazo, { maxLength: 1200, detectMixed: true });

  output.problemas_campos = problems;
  output.campos_faltantes = Object.values(problems).map((problem) => problem.message);
  const totalFields = 5 + Object.keys(diagnosticLabels).length + 4 + Math.max(1, output.capacitaciones.length * 5);
  output.confianza = Math.max(0, Math.min(100, Math.round(((totalFields - Object.keys(problems).length) / totalFields) * 100)));

  const isPlan = options.isPlan !== false;
  const possiblePlan = Boolean(options.possiblePlan || output.deteccion?.posible_plan || output.deteccion?.confirmado_como_plan);
  if (!isPlan && !possiblePlan) output.estado = "NO_ES_PLAN";
  else output.estado = Object.keys(problems).length ? "REVISAR" : "COMPLETO";

  return output;
}

module.exports = {
  DEFAULT_DEDICATION,
  MIXED_CONTENT_PATTERNS,
  hasMixedContent,
  validatePlanRecord
};
