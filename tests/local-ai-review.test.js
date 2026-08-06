"use strict";

const assert = require("assert");
const { mergeAiCandidate } = require("../src/local-ai-review");

function run() {
  const record = {
    docente: {
      nombre: "Docente confirmado",
      carrera: "Desarrollo de Software",
      codigo_documento: "UGPA-RGI1-04-PRO-251-2025-10",
      periodo_plan: "2025-10"
    },
    diagnostico: {
      tipo_formacion: "Específica 3. Evaluaciones de capacitación"
    },
    capacitaciones: [{
      nombre: "Curso confirmado",
      horas: 0,
      fecha_inicio_propuesta: "",
      fecha_fin_propuesta: "",
      tipo: ""
    }],
    detalles_plan: {
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: ""
    },
    problemas_campos: {
      "docente.codigo_documento": { message: "Código dudoso" },
      "diagnostico.tipo_formacion": { message: "Texto mezclado" },
      "capacitaciones.0.horas": { message: "Faltan horas" },
      "capacitaciones.0.fecha_inicio_propuesta": { message: "Falta fecha" },
      "capacitaciones.0.actividades_teoricas": { message: "Faltan actividades" }
    },
    advertencias: []
  };

  const candidate = {
    docente: {
      nombre: "Nombre propuesto por IA",
      carrera: "Otra carrera",
      codigo_documento: "UGPA-RGI1-44-PRO-251-2025-10",
      periodo_plan: "2025-10"
    },
    diagnostico: {
      tipo_formacion: "Específica"
    },
    capacitaciones: [{
      nombre: "Nombre propuesto por IA",
      horas: 40,
      fecha_inicio_propuesta: "octubre de 2025",
      fecha_fin_propuesta: "noviembre de 2025",
      tipo: "Aprobación"
    }],
    detalles_plan: {
      actividades_teoricas: ["Fundamentos"],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: ""
    }
  };

  const merged = mergeAiCandidate(record, candidate);
  assert.strictEqual(merged.docente.nombre, "Docente confirmado");
  assert.strictEqual(merged.docente.carrera, "Desarrollo de Software");
  assert.strictEqual(merged.docente.codigo_documento, "UGPA-RGI1-44-PRO-251-2025-10");
  assert.strictEqual(merged.diagnostico.tipo_formacion, "Específica");
  assert.strictEqual(merged.capacitaciones[0].nombre, "Curso confirmado");
  assert.strictEqual(merged.capacitaciones[0].horas, 40);
  assert.strictEqual(merged.capacitaciones[0].fecha_inicio_propuesta, "octubre de 2025");
  assert.deepStrictEqual(merged.detalles_plan.actividades_teoricas, ["Fundamentos"]);

  console.log("Reparación segura con IA local: correcta.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
