"use strict";

const assert = require("assert");
const {
  extractCode,
  extractPeriod,
  parseTrainings,
  parsePlanText
} = require("../src/plan-parser");

const sample = `
UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS
PLAN INDIVIDUAL DE FORMACIÓN Y CAPACITACIÓN DOCENTE
DOCENTE: ANA MARÍA PÉREZ LÓPEZ
CARRERA: ADMINISTRACIÓN
Código: UGPA-RGI1-03-PRO-251-2025-10

1. Identificación Docente
Nombre Docente Ana María Pérez López
Tiempo de Dedicación Tiempo Completo
Carrera Administración
Función Sustantiva Docencia

2. Capacidades actuales del docente
• ¿En qué curso o programa de actualización has participado en los últimos 12 meses?
Normas APA
• ¿Podrías mencionar uno o más avances recientes en tu campo disciplinar que hayas aplicado en tus clases?
Análisis de datos aplicado a casos reales
• ¿Qué tan cómodo/a te sientes implementando nuevas metodologías de enseñanza en el aula?
Muy cómodo/a
• ¿Qué estrategias pedagógicas innovadoras aplicas en tu práctica docente?
Aprendizaje basado en proyectos; Gamificación
• ¿Qué herramientas tecnológicas utilizas regularmente en tu docencia?
Moodle; Microsoft Teams
• ¿Qué formación académica adicional consideras necesaria para fortalecer tu perfil profesional?
Doctorado
• ¿Cuál es tu nivel académico actual? (título registrado)?
Maestría
• ¿La formación académica que propones es específica o genérica?
Específica

4. Resumen de Capacitación Propuestas
# Nombre de Capacitación Propuesta Horas de Capacitación Propuesta Fecha de propuesta de ejecución Tipo de Capacitación Propuesta
1 Desarrollador de contenidos de aprendizaje 40 Desde el 15 de Diciembre de 2025 hasta el 12 de Enero de 2026 APROBACIÓN
2 Metodologías Ágiles para la Gestión Moderna 40 Desde Marzo 1 de 2026 hasta Marzo 31 de 2026 APROBACIÓN
5. Indicadores
6. Actividades
• Teóricas
- Principios de Scrum y Kanban
- Fundamentos de gestión ágil
• Prácticas
- Simulación de sprint planning
- Uso de tableros Kanban digitales
7. Impacto esperado en el docente
Mejorar la integración curricular mediante TIC e innovación
8. Visión a largo plazo (3 a 5 años)
Liderar proyectos académicos con innovación digital
Formación Docente
`;

function run() {
  assert.strictEqual(extractCode(sample), "UGPA-RGI1-03-PRO-251-2025-10");
  assert.strictEqual(extractPeriod(extractCode(sample)), "2025-10");

  const trainings = parseTrainings(sample);
  assert.strictEqual(trainings.length, 2);
  assert.strictEqual(trainings[0].nombre, "Desarrollador de contenidos de aprendizaje");
  assert.strictEqual(trainings[0].horas, 40);
  assert.strictEqual(trainings[0].fecha_inicio_propuesta, "el 15 de Diciembre de 2025");
  assert.strictEqual(trainings[0].fecha_fin_propuesta, "el 12 de Enero de 2026");

  const record = parsePlanText(sample, {
    fileName: "plan.pdf",
    filePath: "C:/planes/plan.pdf",
    hash: "abc",
    size: 1234,
    pages: 6,
    method: "DIGITAL"
  });

  assert.strictEqual(record.estado, "COMPLETO");
  assert.strictEqual(record.docente.nombre, "Ana María Pérez López");
  assert.strictEqual(record.docente.carrera, "Administración");
  assert.strictEqual(record.docente.tiempo_dedicacion, "Tiempo Completo");
  assert.strictEqual(record.docente.nivel_academico_actual, "Maestría");
  assert.strictEqual(record.diagnostico.capacitacion_12_meses, "Normas APA");
  assert.strictEqual(record.diagnostico.herramientas_tecnologicas, "Moodle; Microsoft Teams");
  assert.strictEqual(record.capacitaciones.length, 2);
  assert.deepStrictEqual(record.capacitaciones[0].actividades_teoricas, [
    "Principios de Scrum y Kanban",
    "Fundamentos de gestión ágil"
  ]);
  assert.deepStrictEqual(record.capacitaciones[0].actividades_practicas, [
    "Simulación de sprint planning",
    "Uso de tableros Kanban digitales"
  ]);
  assert.strictEqual(record.capacitaciones[0].impacto_esperado, "Mejorar la integración curricular mediante TIC e innovación");
  assert.strictEqual(record.capacitaciones[0].vision_largo_plazo, "Liderar proyectos académicos con innovación digital");
  assert.strictEqual(record.capacitaciones[0].detalle_compartido_entre_capacitaciones, true);

  console.log("Extractor de planes: pruebas correctas.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
