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

function list(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function hasMixedContent(value, maxLength = 700) {
  const source = clean(value);
  if (!source) return false;
  if (source.length > maxLength) return true;
  return MIXED_CONTENT_PATTERNS.some((pattern) => pattern.test(source));
}

function addIssue(collection, path, label, message, options = {}) {
  if (collection[path]) return;
  collection[path] = {
    path,
    label,
    message,
    type: options.type || "missing",
    severity: options.severity || "error",
    category: options.category || "lectura",
    layer: options.layer || "campos"
  };
}

function addProblem(problems, path, label, message, type = "missing", category = "lectura", layer = "campos") {
  addIssue(problems, path, label, message, { type, severity: "error", category, layer });
}

function addWarning(warnings, path, label, message, category = "advertencia", layer = "semantica") {
  addIssue(warnings, path, label, message, { type: "warning", severity: "warning", category, layer });
}

function validateRequiredText(problems, path, label, value, options = {}) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `No se pudo confirmar: ${label}.`, "missing", options.category || "lectura", options.layer || "campos");
    return;
  }
  if (options.maxLength && source.length > options.maxLength) {
    addProblem(problems, path, label, `${label} parece contener texto mezclado.`, "invalid", "lectura", "semantica");
    return;
  }
  if (options.detectMixed && hasMixedContent(source, options.maxLength || 700)) {
    addProblem(problems, path, label, `${label} parece contener texto de otra sección.`, "invalid", "lectura", "semantica");
  }
}

function validateCode(problems, warnings, code, template) {
  const source = clean(code);
  if (!source) {
    if (template === "ANTIGUA") {
      addWarning(warnings, "docente.codigo_documento", "Código del documento", "La plantilla antigua no muestra un código documental; este campo no bloquea el plan.", "plantilla", "plantilla");
    } else {
      addProblem(problems, "docente.codigo_documento", "Código del documento", "El código aparece en la plantilla moderna, pero ningún motor pudo confirmarlo.", "missing", "lectura", "lectura");
    }
    return;
  }
  if (!isValidPlanCode(source)) {
    addProblem(
      problems,
      "docente.codigo_documento",
      "Código del documento",
      /-00-PRO-251/i.test(source)
        ? "El consecutivo 00 del código es inválido o fue leído incorrectamente."
        : "El código no tiene el formato esperado de un Plan PRO-251.",
      "invalid",
      /-00-PRO-251/i.test(source) ? "contenido" : "lectura",
      "campos"
    );
  }
}

function validatePeriod(problems, warnings, period, code, template) {
  const source = clean(period);
  if (!source) {
    if (template === "ANTIGUA") {
      addWarning(warnings, "docente.periodo_plan", "Periodo del plan", "La plantilla antigua no permite confirmar el periodo desde un código documental.", "plantilla", "plantilla");
    } else {
      addProblem(problems, "docente.periodo_plan", "Periodo del plan", "No se pudo obtener el periodo del código del documento.", "missing", "lectura", "cruzada");
    }
    return;
  }
  if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(source)) {
    addProblem(problems, "docente.periodo_plan", "Periodo del plan", "El periodo debe tener el formato AAAA-MM.", "invalid", "contenido", "campos");
    return;
  }
  const codePeriod = clean(code).match(/(20\d{2}-(?:0[1-9]|1[0-2]))$/)?.[1] || "";
  if (codePeriod && codePeriod !== source) {
    addProblem(problems, "docente.periodo_plan", "Periodo del plan", "El periodo no coincide con el código del documento.", "invalid", "contenido", "cruzada");
  }
}

function validateTrainingName(problems, path, label, value) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `No se pudo confirmar: ${label}.`, "missing", "lectura", "campos");
    return;
  }
  if (
    source.length > 220
    || /\b(?:desde|hasta|aprobaci[oó]n|horas?\s+de\s+capacitaci[oó]n|fecha\s+de\s+propuesta)\b/i.test(source)
    || hasMixedContent(source, 220)
  ) {
    addProblem(problems, path, label, `${label} parece mezclar el nombre con horas, fechas u otra sección.`, "invalid", "lectura", "semantica");
  }
}

function validateHours(problems, warnings, path, label, value) {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    addProblem(problems, path, label, `No se pudo confirmar: ${label}.`, "missing", "lectura", "campos");
  } else if (hours > 1000) {
    addProblem(problems, path, label, `${label} supera el límite razonable de 1000 horas.`, "invalid", "contenido", "semantica");
  } else if (hours > 500) {
    addWarning(warnings, path, label, `${label} es inusualmente alto; conviene verificarlo.`, "contenido", "semantica");
  }
}

const MONTHS = Object.freeze({
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
});

function dateParts(value) {
  const source = normalize(value);
  if (!source) return null;
  const iso = source.match(/\b(20\d{2})\s+(0?[1-9]|1[0-2])\s+(0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  const text = source.match(/\b(?:el\s+)?(0?[1-9]|[12]\d|3[01])\s+de\s+([a-z]+)\s+de\s+(20\d{2})\b/)
    || source.match(/\b([a-z]+)\s+(0?[1-9]|[12]\d|3[01])\s+de\s+(20\d{2})\b/);
  if (text) {
    if (MONTHS[text[2]]) return { year: Number(text[3]), month: MONTHS[text[2]], day: Number(text[1]) };
    if (MONTHS[text[1]]) return { year: Number(text[3]), month: MONTHS[text[1]], day: Number(text[2]) };
  }
  const monthYear = source.match(/\b([a-z]+)\s+(?:del?\s+)?(20\d{2})\b/);
  if (monthYear && MONTHS[monthYear[1]]) return { year: Number(monthYear[2]), month: MONTHS[monthYear[1]], day: 1 };
  const year = source.match(/\b(20\d{2})\b/);
  return year ? { year: Number(year[1]), month: 1, day: 1 } : null;
}

function dateNumber(parts) {
  return parts ? (parts.year * 10000) + (parts.month * 100) + parts.day : 0;
}

function validateDateText(problems, warnings, path, label, value) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `No se pudo confirmar: ${label}.`, "missing", "lectura", "campos");
    return null;
  }
  if (source.length > 140 || hasMixedContent(source, 140) || /\b(?:aprobaci[oó]n|horas?\s+de\s+capacitaci[oó]n)\b/i.test(source)) {
    addProblem(problems, path, label, `${label} parece contener información de otra columna.`, "invalid", "lectura", "semantica");
    return dateParts(source);
  }
  const parts = dateParts(source);
  if (!parts) {
    addWarning(warnings, path, label, `${label} se conservó como texto porque no pudo normalizarse automáticamente.`, "lectura", "campos");
    return null;
  }
  const currentYear = new Date().getFullYear();
  if (parts.year > currentYear + 10) {
    addProblem(problems, path, label, `${label} contiene un año sospechoso (${parts.year}).`, "invalid", "contenido", "semantica");
  }
  return parts;
}

function validateTrainingType(problems, path, label, value) {
  const source = clean(value);
  if (!source) {
    addProblem(problems, path, label, `No se pudo confirmar: ${label}.`, "missing", "lectura", "campos");
    return;
  }
  const normalized = normalize(source);
  if (source.length > 60 || hasMixedContent(source, 60) || ![...VALID_TRAINING_TYPES].some((type) => normalized.includes(type))) {
    addProblem(problems, path, label, `${label} no coincide con un tipo de capacitación reconocido.`, "invalid", "lectura", "semantica");
  }
}

function validateActivityList(problems, path, label, value) {
  const values = list(value);
  if (!values.length) {
    addProblem(problems, path, label, `No se pudo confirmar: ${label}.`, "missing", "lectura", "estructura");
    return;
  }
  const joined = values.join(" · ");
  if (hasMixedContent(joined, 1600)) {
    addProblem(problems, path, label, `${label} parece contener partes de otras secciones.`, "invalid", "lectura", "semantica");
  }
}

function validationLayerSummary(problems, warnings) {
  const layers = ["lectura", "estructura", "campos", "cruzada", "semantica", "consenso", "plantilla", "duplicados", "manual"];
  return Object.fromEntries(layers.map((layer) => {
    const errors = Object.values(problems).filter((item) => item.layer === layer);
    const notices = Object.values(warnings).filter((item) => item.layer === layer);
    return [layer, { ok: errors.length === 0, errores: errors.length, advertencias: notices.length }];
  }));
}

function validatePlanRecord(record, options = {}) {
  const output = clone(record);
  output.docente = output.docente || {};
  output.diagnostico = output.diagnostico || {};
  output.capacitaciones = Array.isArray(output.capacitaciones) ? output.capacitaciones : [];
  output.docente.tiempo_dedicacion = DEFAULT_DEDICATION;

  if (output.estado === "ERROR" && options.preserveError !== false) {
    output.problemas_campos = output.problemas_campos || {};
    output.advertencias_campos = output.advertencias_campos || {};
    return output;
  }

  const problems = {};
  const warnings = {};
  const template = output.deteccion?.plantilla || "DESCONOCIDA";

  validateRequiredText(problems, "docente.nombre", "Nombre del docente", output.docente.nombre, { maxLength: 140, detectMixed: true, layer: "estructura" });
  validateRequiredText(problems, "docente.carrera", "Carrera", output.docente.carrera, { maxLength: 160, detectMixed: true, layer: "estructura" });
  validateRequiredText(problems, "docente.nivel_academico_actual", "Nivel académico actual", output.docente.nivel_academico_actual, { maxLength: 180, detectMixed: true });
  validateCode(problems, warnings, output.docente.codigo_documento, template);
  validatePeriod(problems, warnings, output.docente.periodo_plan, output.docente.codigo_documento, template);

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
      { maxLength: field === "tipo_formacion" ? 400 : 1200, detectMixed: true, layer: "estructura" }
    );
  });

  if (!output.capacitaciones.length) {
    addProblem(problems, "capacitaciones", "Capacitaciones propuestas", "No se encontraron filas de capacitaciones propuestas.", "missing", "lectura", "estructura");
  } else {
    output.capacitaciones.forEach((training, index) => {
      const number = index + 1;
      const base = `capacitaciones.${index}`;
      const prefix = `Capacitación ${number}`;
      training.orden = number;
      training.actividades_teoricas = list(training.actividades_teoricas);
      training.actividades_practicas = list(training.actividades_practicas);

      validateTrainingName(problems, `${base}.nombre`, `${prefix}: nombre`, training.nombre);
      validateHours(problems, warnings, `${base}.horas`, `${prefix}: horas`, training.horas);
      const start = validateDateText(problems, warnings, `${base}.fecha_inicio_propuesta`, `${prefix}: fecha de inicio`, training.fecha_inicio_propuesta);
      const end = validateDateText(problems, warnings, `${base}.fecha_fin_propuesta`, `${prefix}: fecha de finalización`, training.fecha_fin_propuesta);
      if (start && end && dateNumber(end) < dateNumber(start)) {
        addProblem(problems, `${base}.fecha_fin_propuesta`, `${prefix}: fecha de finalización`, "La fecha final es anterior a la fecha inicial.", "invalid", "contenido", "cruzada");
      }
      validateTrainingType(problems, `${base}.tipo`, `${prefix}: tipo`, training.tipo);
    });
  }

  const expectedRows = Math.max(
    Number(output.inteligencia_tabla?.filas_textuales || 0),
    Number(output.inteligencia_tabla?.filas_posicionales || 0),
    Number(output.inteligencia_tabla?.filas_ocr || 0)
  );
  if (expectedRows > output.capacitaciones.length) {
    addProblem(
      problems,
      "capacitaciones",
      "Capacitaciones propuestas",
      `Los motores detectaron ${expectedRows} filas, pero solo se reconstruyeron ${output.capacitaciones.length}.`,
      "invalid",
      "lectura",
      "consenso"
    );
  }

  const shared = resolveSharedDetails(output);
  output.detalles_plan = shared;
  validateActivityList(problems, "detalles_plan.actividades_teoricas", "Actividades teóricas del plan", shared.actividades_teoricas);
  validateActivityList(problems, "detalles_plan.actividades_practicas", "Actividades prácticas del plan", shared.actividades_practicas);
  validateRequiredText(problems, "detalles_plan.impacto_esperado", "Impacto esperado del plan", shared.impacto_esperado, { maxLength: 1600, detectMixed: true, layer: "estructura" });
  validateRequiredText(problems, "detalles_plan.vision_largo_plazo", "Visión a largo plazo del plan", shared.vision_largo_plazo, { maxLength: 1600, detectMixed: true, layer: "estructura" });

  const executedEngines = output.deteccion?.motores_ejecutados || [];
  if (executedEngines.length >= 2) {
    addWarning(warnings, "_consenso", "Consenso multimotor", `${executedEngines.length} motores independientes participaron en la decisión por campo.`, "consenso", "consenso");
  }
  if (template === "ANTIGUA") {
    addWarning(warnings, "_plantilla", "Plantilla", "Se identificó una plantilla antigua; código y periodo no se consideran obligatorios.", "plantilla", "plantilla");
  }

  output.problemas_campos = problems;
  output.advertencias_campos = warnings;
  output.campos_faltantes = Object.values(problems).map((problem) => problem.message);
  output.validaciones = validationLayerSummary(problems, warnings);

  const problemValues = Object.values(problems);
  const warningValues = Object.values(warnings);
  const totalFields = 5 + Object.keys(diagnosticLabels).length + 4 + Math.max(1, output.capacitaciones.length * 5);
  output.confianza = Math.max(0, Math.min(100, Math.round(((totalFields - problemValues.length - warningValues.length * 0.15) / totalFields) * 100)));

  const isPlan = options.isPlan !== false;
  const possiblePlan = Boolean(options.possiblePlan || output.deteccion?.posible_plan || output.deteccion?.confirmado_como_plan);
  if (!isPlan && !possiblePlan) {
    output.estado = "NO_ES_PLAN";
    output.estado_detallado = "NO_ES_PLAN";
  } else if (problemValues.length) {
    output.estado = "REVISAR";
    output.estado_detallado = problemValues.some((item) => item.category === "contenido")
      ? "REVISAR_CONTENIDO"
      : "REVISAR_LECTURA";
  } else {
    output.estado = "COMPLETO";
    if (template === "ANTIGUA") output.estado_detallado = "PLANTILLA_ANTIGUA";
    else output.estado_detallado = warningValues.length ? "COMPLETO_CON_ADVERTENCIAS" : "COMPLETO";
  }

  return output;
}

module.exports = {
  DEFAULT_DEDICATION,
  MIXED_CONTENT_PATTERNS,
  hasMixedContent,
  dateParts,
  validatePlanRecord
};