"use strict";

const assert = require("assert");
const {
  cleanExtractionText,
  extractCodeCandidates,
  runHeaderCodeEngine
} = require("../src/header-code-engine");
const { runTextTableEngine } = require("../src/text-table-engine");
const { consensusPlanRecords } = require("../src/plan-consensus");
const { validatePlanRecord } = require("../src/plan-validation");

function completeRecord(overrides = {}) {
  return {
    id: "test-plan",
    archivo: { nombre: "plan.pdf", metodo_lectura: "PRUEBA" },
    docente: {
      nombre: "Willian Rodrigo Espinoza Perez",
      carrera: "Administración",
      tiempo_dedicacion: "Tiempo Completo",
      nivel_academico_actual: "Maestría",
      codigo_documento: "UGPA-RGI1-01-PRO-251-2025-10",
      periodo_plan: "2025-10"
    },
    diagnostico: {
      capacitacion_12_meses: "Normas APA",
      avances_aplicados: "Realización de artículos científicos con normas APA",
      comodidad_metodologias: "Muy cómodo/a",
      estrategias_pedagogicas: "Aprendizaje basado en proyectos; Gamificación; Aprendizaje colaborativo",
      herramientas_tecnologicas: "Zoom; Kahoot; Microsoft Teams; Moodle; Canva; Mentimeter",
      formacion_adicional: "Doctorado",
      tipo_formacion: "Genérica"
    },
    capacitaciones: [
      {
        orden: 1,
        nombre: "Desarrollador de contenidos de aprendizaje",
        horas: 40,
        fecha_inicio_propuesta: "15 de diciembre de 2025",
        fecha_fin_propuesta: "12 de enero de 2026",
        tipo: "Aprobación",
        actividades_teoricas: ["Principios de Scrum y Kanban"],
        actividades_practicas: ["Simulación de sprint planning"],
        impacto_esperado: "Mejorar la integración curricular mediante TIC e innovación",
        vision_largo_plazo: "Liderar proyectos académicos con innovación digital"
      },
      {
        orden: 2,
        nombre: "Metodologías Ágiles para la Gestión Moderna",
        horas: 40,
        fecha_inicio_propuesta: "1 de marzo de 2026",
        fecha_fin_propuesta: "31 de marzo de 2026",
        tipo: "Aprobación",
        actividades_teoricas: ["Fundamentos de gestión ágil"],
        actividades_practicas: ["Uso de tableros Kanban digitales"],
        impacto_esperado: "Mejorar la integración curricular mediante TIC e innovación",
        vision_largo_plazo: "Liderar proyectos académicos con innovación digital"
      }
    ],
    deteccion: { plantilla: "MODERNA", posible_plan: true, confirmado_como_plan: true },
    estado: "REVISAR",
    advertencias: [],
    ...overrides
  };
}

function run() {
  const corrupted = "Código: UGPA-RGI1-01-PRO\ufffe251-2025-10";
  assert.ok(cleanExtractionText(corrupted).includes("PRO-251"));
  assert.strictEqual(extractCodeCandidates(corrupted)[0].value, "UGPA-RGI1-01-PRO-251-2025-10");

  const code = runHeaderCodeEngine({
    linearText: corrupted,
    positionalText: "UGPA-RGI1-01-PRO-\n251-2025-10",
    codeRegionText: "UGPA-RGI1-01-PRO- 251-2025-10"
  });
  assert.strictEqual(code.code, "UGPA-RGI1-01-PRO-251-2025-10");
  assert.strictEqual(code.period, "2025-10");
  assert.strictEqual(code.template, "MODERNA");

  const tableText = `
4. Resumen de Capacitación Propuestas
#
Nombre de Capacitación Propuesta
Horas de Capacitación Propuesta
Fecha de propuesta de ejecución
Tipo de Capacitación Propuesta
1 Desarrollador de
contenidos de aprendizaje 40
Desde el 15 de
Diciembre de 2025
hasta el 12 de
Enero de 2026
APROBACIÓN
2 Metodologías Ágiles para
la Gestión Moderna 40
Desde Marzo 1 de
2026 hasta Marzo
31 de 2026 APROBACIÓN
5. Indicadores
`;
  const table = runTextTableEngine(tableText);
  assert.strictEqual(table.rowCount, 2);
  assert.strictEqual(table.rows[0].nombre, "Desarrollador de contenidos de aprendizaje");
  assert.strictEqual(table.rows[0].horas, 40);
  assert.strictEqual(table.rows[1].nombre, "Metodologías Ágiles para la Gestión Moderna");
  assert.strictEqual(table.rows[1].tipo.toUpperCase(), "APROBACIÓN");

  const linear = completeRecord();
  const positional = completeRecord({
    id: "positional",
    docente: { ...completeRecord().docente, codigo_documento: "", periodo_plan: "" },
    capacitaciones: [completeRecord().capacitaciones[0]]
  });
  const consensus = consensusPlanRecords([
    { engine: "DIGITAL_LINEAL", record: linear },
    { engine: "DIGITAL_POSICIONAL", record: positional }
  ], { codeResult: code });
  assert.strictEqual(consensus.docente.codigo_documento, "UGPA-RGI1-01-PRO-251-2025-10");
  assert.strictEqual(consensus.capacitaciones.length, 2);

  const validated = validatePlanRecord(consensus, { isPlan: true, possiblePlan: true });
  assert.strictEqual(validated.estado, "COMPLETO");
  assert.strictEqual(Object.keys(validated.problemas_campos).length, 0);
  assert.ok(validated.validaciones.lectura.ok);
  assert.ok(validated.validaciones.estructura.ok);

  const legacy = completeRecord({
    docente: {
      ...completeRecord().docente,
      codigo_documento: "",
      periodo_plan: ""
    },
    deteccion: { plantilla: "ANTIGUA", posible_plan: true, confirmado_como_plan: true }
  });
  const legacyValidated = validatePlanRecord(legacy, { isPlan: true, possiblePlan: true });
  assert.strictEqual(legacyValidated.estado, "COMPLETO");
  assert.strictEqual(legacyValidated.estado_detallado, "PLANTILLA_ANTIGUA");
  assert.strictEqual(Object.keys(legacyValidated.problemas_campos).length, 0);

  const suspicious = completeRecord();
  suspicious.capacitaciones[0].fecha_fin_propuesta = "31 de marzo de 2042";
  const suspiciousValidated = validatePlanRecord(suspicious, { isPlan: true, possiblePlan: true });
  assert.strictEqual(suspiciousValidated.estado, "REVISAR");
  assert.strictEqual(suspiciousValidated.estado_detallado, "REVISAR_CONTENIDO");
  assert.ok(suspiciousValidated.problemas_campos["capacitaciones.0.fecha_fin_propuesta"]);

  console.log("Motores independientes, consenso por campo y validaciones múltiples: correctos.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}