"use strict";

const crypto = require("crypto");
const { extractPeriod } = require("./plan-parser");
const { DEFAULT_DEDICATION, validatePlanRecord } = require("./plan-validation");

const PLAN_TABLE_COLUMNS = Object.freeze([
  "archivo_pdf",
  "codigo_documento",
  "periodo_plan",
  "nombre_docente",
  "carrera",
  "tiempo_dedicacion",
  "nivel_academico_actual",
  "capacitacion_ultimos_12_meses",
  "avances_disciplinares_aplicados",
  "comodidad_nuevas_metodologias",
  "estrategias_pedagogicas",
  "herramientas_tecnologicas",
  "formacion_academica_adicional",
  "tipo_formacion",
  "nombre_capacitacion",
  "horas",
  "fecha_inicio",
  "fecha_fin",
  "tipo_capacitacion",
  "actividades_teoricas",
  "actividades_practicas",
  "impacto_esperado",
  "vision_largo_plazo"
]);

const PLACEHOLDERS = new Set([
  "no encontrado",
  "no encontrada",
  "no identificable",
  "no disponible",
  "no aplica",
  "n a",
  "n/a",
  "s d",
  "s/d",
  "-",
  "—"
]);

const PLAN_FIELDS = Object.freeze([
  ["archivo_pdf", "archivo.nombre", "Archivo PDF"],
  ["codigo_documento", "docente.codigo_documento", "Código del documento"],
  ["periodo_plan", "docente.periodo_plan", "Periodo del plan"],
  ["nombre_docente", "docente.nombre", "Nombre del docente"],
  ["carrera", "docente.carrera", "Carrera"],
  ["nivel_academico_actual", "docente.nivel_academico_actual", "Nivel académico actual"],
  ["capacitacion_ultimos_12_meses", "diagnostico.capacitacion_12_meses", "Capacitación realizada en los últimos 12 meses"],
  ["avances_disciplinares_aplicados", "diagnostico.avances_aplicados", "Avances disciplinares aplicados en clases"],
  ["comodidad_nuevas_metodologias", "diagnostico.comodidad_metodologias", "Nivel de comodidad con nuevas metodologías"],
  ["estrategias_pedagogicas", "diagnostico.estrategias_pedagogicas", "Estrategias pedagógicas utilizadas"],
  ["herramientas_tecnologicas", "diagnostico.herramientas_tecnologicas", "Herramientas tecnológicas utilizadas"],
  ["formacion_academica_adicional", "diagnostico.formacion_adicional", "Formación académica adicional necesaria"],
  ["tipo_formacion", "diagnostico.tipo_formacion", "Tipo de formación requerida"]
]);

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/^\uFEFF/, "")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
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

function cleanCell(value) {
  const source = clean(value).replace(/^(["'])(.*)\1$/s, "$2").trim();
  return PLACEHOLDERS.has(normalize(source)) ? "" : source;
}

function stripCodeFence(value) {
  const source = String(value || "").replace(/^\uFEFF/, "").trim();
  return source
    .replace(/^```(?:tsv|text|txt)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/\s+/g, "_");
}

function parseTsvRows(tableText) {
  const source = stripCodeFence(tableText);
  if (!source) throw new Error("Pega primero la tabla TSV generada por ChatGPT.");

  const lines = source.split("\n").map((line) => line.replace(/\r$/, "")).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("La tabla debe incluir la fila de encabezados y al menos un registro.");

  if (!lines[0].includes("\t") && lines[0].includes("|")) {
    throw new Error("La tabla está en formato Markdown. Copia la versión TSV con columnas separadas por tabulaciones.");
  }

  const headers = lines[0].split("\t").map(normalizeHeader);
  const missingHeaders = PLAN_TABLE_COLUMNS.filter((column) => !headers.includes(column));
  const extraHeaders = headers.filter((column) => !PLAN_TABLE_COLUMNS.includes(column));
  if (missingHeaders.length || extraHeaders.length || headers.length !== PLAN_TABLE_COLUMNS.length) {
    const details = [];
    if (missingHeaders.length) details.push(`faltan: ${missingHeaders.join(", ")}`);
    if (extraHeaders.length) details.push(`sobran o cambiaron: ${extraHeaders.join(", ")}`);
    throw new Error(`Las columnas no coinciden con el formato requerido (${details.join("; ")}).`);
  }

  const rows = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rawCells = lines[lineIndex].split("\t");
    while (rawCells.length > headers.length && !clean(rawCells[rawCells.length - 1])) rawCells.pop();
    if (rawCells.length !== headers.length) {
      throw new Error(`La fila ${lineIndex + 1} tiene ${rawCells.length} columnas; se esperaban ${headers.length}.`);
    }
    const row = {};
    headers.forEach((header, index) => { row[header] = cleanCell(rawCells[index]); });
    row.__rowNumber = lineIndex + 1;
    rows.push(row);
  }

  return rows;
}

function tableGroupKey(row) {
  const code = normalize(row.codigo_documento);
  if (code) return `codigo:${code}`;
  const file = normalize(row.archivo_pdf);
  const teacher = normalize(row.nombre_docente);
  const period = normalize(row.periodo_plan);
  if (!file && !teacher) return `fila:${row.__rowNumber}`;
  return `alterno:${file}|${teacher}|${period}`;
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  let target = object;
  parts.forEach((part) => {
    target[part] = target[part] || {};
    target = target[part];
  });
  target[last] = value;
}

function firstValue(rows, column) {
  return rows.map((row) => cleanCell(row[column])).find(Boolean) || "";
}

function conflictsFor(rows, column) {
  const values = rows.map((row) => cleanCell(row[column])).filter(Boolean);
  const distinct = new Map();
  values.forEach((value) => distinct.set(normalize(value), value));
  return [...distinct.values()];
}

function parseHours(value) {
  const source = cleanCell(value);
  if (!source) return 0;
  const match = source.replace(/,/g, ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function splitActivities(value) {
  const source = cleanCell(value);
  if (!source) return [];
  return source
    .split(/\s*[•·▪◦]\s*|\s*;\s*|\s*\|\s*/)
    .map(cleanCell)
    .filter(Boolean);
}

function trainingKey(training) {
  return [
    normalize(training.nombre),
    String(training.horas || ""),
    normalize(training.fecha_inicio_propuesta),
    normalize(training.fecha_fin_propuesta)
  ].join("|");
}

function tableHash(key) {
  return `tabla:${crypto.createHash("sha256").update(key).digest("hex")}`;
}

function createBaseRecord(groupKey, rows) {
  const record = {
    id: crypto.randomUUID(),
    archivo: {
      nombre: firstValue(rows, "archivo_pdf") || "Tabla sin nombre de archivo",
      ruta: "",
      hash: tableHash(groupKey),
      tamano: 0,
      paginas: 0,
      metodo_lectura: "TABLA",
      fecha_procesamiento: new Date().toISOString()
    },
    docente: {
      nombre: firstValue(rows, "nombre_docente"),
      carrera: firstValue(rows, "carrera"),
      tiempo_dedicacion: DEFAULT_DEDICATION,
      nivel_academico_actual: firstValue(rows, "nivel_academico_actual"),
      codigo_documento: firstValue(rows, "codigo_documento"),
      periodo_plan: firstValue(rows, "periodo_plan")
    },
    diagnostico: {
      capacitacion_12_meses: firstValue(rows, "capacitacion_ultimos_12_meses"),
      avances_aplicados: firstValue(rows, "avances_disciplinares_aplicados"),
      comodidad_metodologias: firstValue(rows, "comodidad_nuevas_metodologias"),
      estrategias_pedagogicas: firstValue(rows, "estrategias_pedagogicas"),
      herramientas_tecnologicas: firstValue(rows, "herramientas_tecnologicas"),
      formacion_adicional: firstValue(rows, "formacion_academica_adicional"),
      tipo_formacion: firstValue(rows, "tipo_formacion")
    },
    capacitaciones: [],
    estado: "REVISAR",
    confianza: 0,
    campos_faltantes: [],
    problemas_campos: {},
    advertencias: [],
    deteccion: {
      puntaje_plan: 100,
      confirmado_como_plan: true,
      posible_plan: true,
      origen_tabla: true
    },
    correccion_manual: false,
    fecha_correccion: "",
    importacion_tabla: {
      filas_origen: rows.map((row) => row.__rowNumber),
      fecha_importacion: new Date().toISOString()
    }
  };

  if (!record.docente.periodo_plan && record.docente.codigo_documento) {
    record.docente.periodo_plan = extractPeriod(record.docente.codigo_documento);
  }

  return record;
}

function applyPlanConflicts(record, rows) {
  const conflictProblems = {};
  PLAN_FIELDS.forEach(([column, path, label]) => {
    const values = conflictsFor(rows, column);
    if (values.length <= 1) return;
    conflictProblems[path] = {
      path,
      label,
      type: "conflict",
      message: `${label} tiene valores diferentes entre las filas pegadas.`
    };
  });
  return conflictProblems;
}

function createTraining(row, index) {
  return {
    orden: index + 1,
    nombre: cleanCell(row.nombre_capacitacion),
    horas: parseHours(row.horas),
    fecha_inicio_propuesta: cleanCell(row.fecha_inicio),
    fecha_fin_propuesta: cleanCell(row.fecha_fin),
    fecha_rango_original: [cleanCell(row.fecha_inicio), cleanCell(row.fecha_fin)].filter(Boolean).join(" hasta "),
    tipo: cleanCell(row.tipo_capacitacion),
    actividades_teoricas: splitActivities(row.actividades_teoricas),
    actividades_practicas: splitActivities(row.actividades_practicas),
    impacto_esperado: cleanCell(row.impacto_esperado),
    vision_largo_plazo: cleanCell(row.vision_largo_plazo),
    detalle_compartido_entre_capacitaciones: false
  };
}

function isEmptyTrainingRow(row) {
  return [
    row.nombre_capacitacion,
    row.horas,
    row.fecha_inicio,
    row.fecha_fin,
    row.tipo_capacitacion,
    row.actividades_teoricas,
    row.actividades_practicas,
    row.impacto_esperado,
    row.vision_largo_plazo
  ].every((value) => !cleanCell(value));
}

function finalizeWithConflicts(record, conflicts) {
  const validated = validatePlanRecord(record, { isPlan: true, possiblePlan: true });
  validated.problemas_campos = {
    ...(validated.problemas_campos || {}),
    ...conflicts
  };
  validated.campos_faltantes = Object.values(validated.problemas_campos).map((problem) => problem.message);
  validated.estado = Object.keys(validated.problemas_campos).length ? "REVISAR" : "COMPLETO";

  const trainingFieldCount = Math.max(1, validated.capacitaciones.length * 9);
  const totalFields = 5 + 7 + trainingFieldCount;
  validated.confianza = Math.max(
    0,
    Math.min(100, Math.round(((totalFields - Object.keys(validated.problemas_campos).length) / totalFields) * 100))
  );
  return validated;
}

function parsePlanTable(tableText) {
  const rows = parseTsvRows(tableText);
  const groups = new Map();
  rows.forEach((row) => {
    const key = tableGroupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const records = [];
  for (const [groupKey, groupRows] of groups.entries()) {
    const record = createBaseRecord(groupKey, groupRows);
    const seenTrainings = new Set();
    groupRows.forEach((row) => {
      if (isEmptyTrainingRow(row)) return;
      const training = createTraining(row, record.capacitaciones.length);
      const key = trainingKey(training);
      if (seenTrainings.has(key)) return;
      seenTrainings.add(key);
      record.capacitaciones.push(training);
    });
    record.capacitaciones.forEach((training, index) => { training.orden = index + 1; });
    records.push(finalizeWithConflicts(record, applyPlanConflicts(record, groupRows)));
  }

  return {
    rows: rows.length,
    plans: records.length,
    trainings: records.reduce((sum, record) => sum + record.capacitaciones.length, 0),
    records
  };
}

module.exports = {
  PLAN_TABLE_COLUMNS,
  cleanCell,
  stripCodeFence,
  parseTsvRows,
  parsePlanTable
};
