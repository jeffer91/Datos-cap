"use strict";

const assert = require("assert");
const {
  DEFAULT_DEDICATION,
  validatePlanRecord
} = require("../src/plan-validation");

function baseRecord() {
  return {
    id: "plan-1",
    archivo: { nombre: "plan.pdf", metodo_lectura: "OCR" },
    docente: {
      nombre: "Verónica Marcela Zapata Yanez",
      carrera: "Desarrollo de Software",
      tiempo_dedicacion: "Medio Tiempo",
      nivel_academico_actual: "Maestría",
      codigo_documento: "UGPA-RGI2-07-PRO-251-2024-10",
      periodo_plan: "2024-10"
    },
    diagnostico: {
      capacitacion_12_meses: "Fundamentos de Python",
      avances_aplicados: "Spring Boot",
      comodidad_metodologias: "Muy cómodo",
      estrategias_pedagogicas: "Uso de TICS",
      herramientas_tecnologicas: "Java, PostgreSQL, Oracle, MySQL y JavaScript",
      formacion_adicional: "Doctorado en Ciencias de la Computación",
      tipo_formacion: "Específica"
    },
    capacitaciones: [{
      orden: 1,
      nombre: "Ethical Hacking",
      horas: 70,
      fecha_inicio_propuesta: "noviembre del 2024",
      fecha_fin_propuesta: "diciembre del 2024",
      tipo: "Aprobación",
      actividades_teoricas: ["Ciberseguridad"],
      actividades_practicas: ["Simulaciones de hacking"],
      impacto_esperado: "Mejorar las competencias de seguridad informática",
      vision_largo_plazo: "Fortalecer la formación tecnológica"
    }],
    deteccion: { confirmado_como_plan: true, posible_plan: true },
    estado: "REVISAR",
    advertencias: []
  };
}

function run() {
  const complete = validatePlanRecord(baseRecord(), { isPlan: true, possiblePlan: true });
  assert.strictEqual(complete.docente.tiempo_dedicacion, DEFAULT_DEDICATION);
  assert.strictEqual(complete.estado, "COMPLETO");
  assert.deepStrictEqual(complete.problemas_campos, {});

  const incorrect = baseRecord();
  incorrect.docente.codigo_documento = "UG12C4~1.PDF";
  incorrect.docente.periodo_plan = "";
  incorrect.diagnostico.tipo_formacion = "Específica 3. Evaluaciones de capacitación texto institucional";
  incorrect.capacitaciones[0].nombre = "N hasta el de contenidos Enero de 2026 Desde Marzo";
  incorrect.capacitaciones[0].horas = 0;
  incorrect.capacitaciones[0].fecha_inicio_propuesta = "";

  const reviewed = validatePlanRecord(incorrect, { isPlan: true, possiblePlan: true });
  assert.strictEqual(reviewed.docente.tiempo_dedicacion, DEFAULT_DEDICATION);
  assert.strictEqual(reviewed.estado, "REVISAR");
  assert.ok(reviewed.problemas_campos["docente.codigo_documento"]);
  assert.ok(reviewed.problemas_campos["docente.periodo_plan"]);
  assert.ok(reviewed.problemas_campos["diagnostico.tipo_formacion"]);
  assert.ok(reviewed.problemas_campos["capacitaciones.0.nombre"]);
  assert.ok(reviewed.problemas_campos["capacitaciones.0.horas"]);
  assert.ok(reviewed.problemas_campos["capacitaciones.0.fecha_inicio_propuesta"]);
  assert.ok(reviewed.campos_faltantes.every((message) => typeof message === "string" && message.length > 0));

  console.log("Validación visual de planes: pruebas correctas.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
