"use strict";

const assert = require("assert");
const {
  repairPlanCode,
  isValidPlanCode,
  cleanTeacherName,
  normalizeCareer,
  applyPlanIntelligence,
  duplicateScore,
  mergePlanRecords
} = require("../src/plan-intelligence");

function baseRecord(overrides = {}) {
  return {
    id: "plan-base",
    archivo: { nombre: "UG080D~1.PDF", hash: "hash-base", fecha_procesamiento: "2026-08-05T10:00:00.000Z" },
    docente: {
      nombre: "Juan Carlos Pazmiño Quiñonez 251-2025-10",
      carrera: "Redes y Telecomunicaones",
      tiempo_dedicacion: "Tiempo Completo",
      nivel_academico_actual: "Maestría",
      codigo_documento: "UG080D~1.PDF",
      periodo_plan: ""
    },
    diagnostico: {
      capacitacion_12_meses: "Curso previo",
      avances_aplicados: "Redes ópticas",
      comodidad_metodologias: "Cómodo",
      estrategias_pedagogicas: "Aprendizaje basado en proyectos",
      herramientas_tecnologicas: "Simuladores",
      formacion_adicional: "Doctorado",
      tipo_formacion: "Específica"
    },
    capacitaciones: [{
      nombre: "Fibra óptica",
      horas: 40,
      fecha_inicio_propuesta: "octubre de 2025",
      fecha_fin_propuesta: "noviembre de 2025",
      tipo: "Aprobación",
      actividades_teoricas: ["Fundamentos de fibra óptica"],
      actividades_practicas: ["Mediciones con OTDR"],
      impacto_esperado: "Actualizar competencias",
      vision_largo_plazo: "Fortalecer laboratorios"
    }],
    advertencias: [],
    ...overrides
  };
}

function run() {
  const repaired = repairPlanCode("UGPA RGI1 05 PRO 251 2025 10");
  assert.strictEqual(repaired, "UGPA-RGI1-05-PRO-251-2025-10");
  assert.strictEqual(isValidPlanCode(repaired), true);
  assert.strictEqual(isValidPlanCode("UGPA-RGI1-00-PRO-251-2025-10"), false);
  assert.strictEqual(cleanTeacherName("Juan Carlos Pazmiño Quiñonez 251-2025-10"), "Juan Carlos Pazmiño Quiñonez");
  assert.strictEqual(normalizeCareer("Redes y Telecomunicaones"), "Redes y Telecomunicaciones");

  const intelligent = applyPlanIntelligence(baseRecord(), {
    rawText: "Código UGPA-RGI1-05-PRO-251-2025-10",
    fileName: "UG080D~1.PDF",
    method: "OCR"
  });
  assert.strictEqual(intelligent.docente.codigo_documento, "UGPA-RGI1-05-PRO-251-2025-10");
  assert.strictEqual(intelligent.docente.periodo_plan, "2025-10");
  assert.strictEqual(intelligent.docente.nombre, "Juan Carlos Pazmiño Quiñonez");
  assert.strictEqual(intelligent.docente.carrera, "Redes y Telecomunicaciones");
  assert.strictEqual(intelligent.detalles_plan.impacto_esperado, "Actualizar competencias");

  const coded = baseRecord({
    id: "plan-coded",
    archivo: { nombre: "plan-codigo.pdf", hash: "hash-coded", fecha_procesamiento: "2026-08-05T11:00:00.000Z" },
    docente: {
      ...baseRecord().docente,
      nombre: "Juan Carlos Pazmiño Quiñonez",
      carrera: "Redes y Telecomunicaciones",
      codigo_documento: "UGPA-RGI1-05-PRO-251-2025-10",
      periodo_plan: "2025-10"
    }
  });
  const alias = applyPlanIntelligence(baseRecord(), { method: "OCR" });
  assert.ok(duplicateScore(coded, alias) >= 0.93);
  const merged = mergePlanRecords(coded, alias);
  assert.strictEqual(merged.docente.codigo_documento, "UGPA-RGI1-05-PRO-251-2025-10");
  assert.strictEqual(merged.archivos_relacionados.length, 2);
  assert.strictEqual(merged.deteccion.consolidado_duplicado, true);

  console.log("Inteligencia y consenso de planes: pruebas correctas.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
