"use strict";

const DEFAULT_ENDPOINT = "http://127.0.0.1:11434/api/chat";

const PLAN_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    docente: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        carrera: { type: "string" },
        nivel_academico_actual: { type: "string" },
        codigo_documento: { type: "string" },
        periodo_plan: { type: "string" }
      },
      required: ["nombre", "carrera", "nivel_academico_actual", "codigo_documento", "periodo_plan"]
    },
    diagnostico: {
      type: "object",
      properties: {
        capacitacion_12_meses: { type: "string" },
        avances_aplicados: { type: "string" },
        comodidad_metodologias: { type: "string" },
        estrategias_pedagogicas: { type: "string" },
        herramientas_tecnologicas: { type: "string" },
        formacion_adicional: { type: "string" },
        tipo_formacion: { type: "string" }
      },
      required: [
        "capacitacion_12_meses", "avances_aplicados", "comodidad_metodologias",
        "estrategias_pedagogicas", "herramientas_tecnologicas", "formacion_adicional", "tipo_formacion"
      ]
    },
    capacitaciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          horas: { type: "number" },
          fecha_inicio_propuesta: { type: "string" },
          fecha_fin_propuesta: { type: "string" },
          tipo: { type: "string" }
        },
        required: ["nombre", "horas", "fecha_inicio_propuesta", "fecha_fin_propuesta", "tipo"]
      }
    },
    detalles_plan: {
      type: "object",
      properties: {
        actividades_teoricas: { type: "array", items: { type: "string" } },
        actividades_practicas: { type: "array", items: { type: "string" } },
        impacto_esperado: { type: "string" },
        vision_largo_plazo: { type: "string" }
      },
      required: ["actividades_teoricas", "actividades_practicas", "impacto_esperado", "vision_largo_plazo"]
    }
  },
  required: ["docente", "diagnostico", "capacitaciones", "detalles_plan"]
});

function clean(value) {
  return String(value == null ? "" : value).replace(/\r\n?/g, "\n").trim();
}

function configuredModel() {
  return clean(process.env.DATOS_CAP_OLLAMA_MODEL);
}

function isLocalAiEnabled() {
  return Boolean(configuredModel());
}

function timeoutSignal(milliseconds) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function fieldHasProblem(record, path) {
  const problems = record?.problemas_campos || {};
  if (problems[path]) return true;
  if (path.startsWith("detalles_plan.")) {
    const field = path.slice("detalles_plan.".length);
    return Object.keys(problems).some((problemPath) => problemPath === path || problemPath.endsWith(`.${field}`));
  }
  return false;
}

function mergeAiCandidate(record, candidate) {
  const output = JSON.parse(JSON.stringify(record || {}));
  const prefer = (current, proposed, path) => {
    const left = clean(current);
    const right = clean(proposed);
    if (!right) return current;
    return !left || fieldHasProblem(output, path) ? proposed : current;
  };
  output.docente = output.docente || {};
  output.diagnostico = output.diagnostico || {};

  Object.entries(candidate?.docente || {}).forEach(([field, value]) => {
    output.docente[field] = prefer(output.docente[field], value, `docente.${field}`);
  });
  Object.entries(candidate?.diagnostico || {}).forEach(([field, value]) => {
    output.diagnostico[field] = prefer(output.diagnostico[field], value, `diagnostico.${field}`);
  });

  const currentTrainings = Array.isArray(output.capacitaciones) ? output.capacitaciones : [];
  const aiTrainings = Array.isArray(candidate?.capacitaciones) ? candidate.capacitaciones : [];
  if (!currentTrainings.length && aiTrainings.length) {
    output.capacitaciones = aiTrainings.map((training, index) => ({
      orden: index + 1,
      nombre: clean(training.nombre),
      horas: Number(training.horas || 0),
      fecha_inicio_propuesta: clean(training.fecha_inicio_propuesta),
      fecha_fin_propuesta: clean(training.fecha_fin_propuesta),
      fecha_rango_original: [training.fecha_inicio_propuesta, training.fecha_fin_propuesta].filter(Boolean).join(" hasta "),
      tipo: clean(training.tipo),
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: "",
      detalle_compartido_entre_capacitaciones: true,
      origen_extraccion: "IA_LOCAL"
    }));
  } else {
    output.capacitaciones = currentTrainings.map((training, index) => {
      const proposed = aiTrainings[index] || {};
      const base = `capacitaciones.${index}`;
      const proposedHours = Number(proposed.horas || 0);
      const currentHours = Number(training.horas || 0);
      return {
        ...training,
        nombre: prefer(training.nombre, proposed.nombre, `${base}.nombre`),
        horas: proposedHours > 0 && (!currentHours || fieldHasProblem(output, `${base}.horas`)) ? proposedHours : currentHours,
        fecha_inicio_propuesta: prefer(training.fecha_inicio_propuesta, proposed.fecha_inicio_propuesta, `${base}.fecha_inicio_propuesta`),
        fecha_fin_propuesta: prefer(training.fecha_fin_propuesta, proposed.fecha_fin_propuesta, `${base}.fecha_fin_propuesta`),
        tipo: prefer(training.tipo, proposed.tipo, `${base}.tipo`)
      };
    });
  }

  const currentDetails = output.detalles_plan || {};
  const proposedDetails = candidate?.detalles_plan || {};
  output.detalles_plan = {
    actividades_teoricas: Array.isArray(proposedDetails.actividades_teoricas)
      && proposedDetails.actividades_teoricas.length
      && (!Array.isArray(currentDetails.actividades_teoricas)
        || !currentDetails.actividades_teoricas.length
        || fieldHasProblem(output, "detalles_plan.actividades_teoricas"))
      ? proposedDetails.actividades_teoricas.map(clean).filter(Boolean)
      : (currentDetails.actividades_teoricas || []),
    actividades_practicas: Array.isArray(proposedDetails.actividades_practicas)
      && proposedDetails.actividades_practicas.length
      && (!Array.isArray(currentDetails.actividades_practicas)
        || !currentDetails.actividades_practicas.length
        || fieldHasProblem(output, "detalles_plan.actividades_practicas"))
      ? proposedDetails.actividades_practicas.map(clean).filter(Boolean)
      : (currentDetails.actividades_practicas || []),
    impacto_esperado: prefer(currentDetails.impacto_esperado, proposedDetails.impacto_esperado, "detalles_plan.impacto_esperado"),
    vision_largo_plazo: prefer(currentDetails.vision_largo_plazo, proposedDetails.vision_largo_plazo, "detalles_plan.vision_largo_plazo")
  };
  output.inteligencia = {
    ...(output.inteligencia || {}),
    ia_local: true,
    modelo_ia_local: configuredModel()
  };
  output.advertencias = [...new Set([
    ...(output.advertencias || []),
    "La IA local completó campos vacíos o marcados como incorrectos; revisa los datos antes de confirmar."
  ])];
  return output;
}

async function reviewPlanWithLocalAi(record, rawText, options = {}) {
  if (!isLocalAiEnabled()) return { used: false, record, reason: "not-configured" };
  const endpoint = clean(process.env.DATOS_CAP_OLLAMA_ENDPOINT) || DEFAULT_ENDPOINT;
  const text = clean(rawText).slice(0, Number(options.maxCharacters || 30000));
  if (!text) return { used: false, record, reason: "empty-text" };

  const prompt = [
    "Extrae exclusivamente información presente en el Plan Individual de Formación y Capacitación Docente.",
    "No inventes datos. Usa cadenas vacías cuando el documento no permita confirmar un campo.",
    "El tiempo de dedicación no debe extraerse porque el sistema lo fija como Tiempo Completo.",
    "Las actividades, impacto y visión pertenecen al plan completo, no deben duplicarse como requisitos independientes por cada capacitación.",
    "Devuelve solo el JSON que cumpla el esquema solicitado.",
    "",
    "TEXTO DEL DOCUMENTO:",
    text
  ].join("\n");

  const timeout = timeoutSignal(Number(options.timeoutMs || 90000));
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: timeout.signal,
      body: JSON.stringify({
        model: configuredModel(),
        stream: false,
        format: PLAN_SCHEMA,
        options: { temperature: 0 },
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) throw new Error(`IA local respondió ${response.status}`);
    const payload = await response.json();
    const content = clean(payload?.message?.content);
    if (!content) throw new Error("IA local no devolvió contenido");
    const candidate = JSON.parse(content);
    return { used: true, record: mergeAiCandidate(record, candidate), candidate };
  } catch (error) {
    return { used: false, record, reason: error.message || "local-ai-error" };
  } finally {
    timeout.clear();
  }
}

module.exports = {
  PLAN_SCHEMA,
  configuredModel,
  isLocalAiEnabled,
  fieldHasProblem,
  mergeAiCandidate,
  reviewPlanWithLocalAi
};
