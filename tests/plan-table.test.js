"use strict";

const assert = require("assert");
const {
  PLAN_TABLE_COLUMNS,
  parseTsvRows,
  parsePlanTable
} = require("../src/plan-table");

const header = PLAN_TABLE_COLUMNS.join("\t");

function row(values = {}) {
  const defaults = {
    archivo_pdf: "UGPA-RGI2-07-PRO-251-2024-10.pdf",
    codigo_documento: "UGPA-RGI2-07-PRO-251-2024-10",
    periodo_plan: "2024-10",
    nombre_docente: "Verónica Marcela Zapata Yanez",
    carrera: "Desarrollo de Software",
    tiempo_dedicacion: "Medio Tiempo",
    nivel_academico_actual: "Maestría",
    capacitacion_ultimos_12_meses: "Fundamentos de Python",
    avances_disciplinares_aplicados: "Spring Boot",
    comodidad_nuevas_metodologias: "Muy cómodo",
    estrategias_pedagogicas: "Uso de TIC",
    herramientas_tecnologicas: "Java, PostgreSQL, Oracle, MySQL y JavaScript",
    formacion_academica_adicional: "Doctorado en Ciencias de la Computación",
    tipo_formacion: "Específica",
    nombre_capacitacion: "Ethical Hacking",
    horas: "70 horas",
    fecha_inicio: "2024-11-01",
    fecha_fin: "2024-12-20",
    tipo_capacitacion: "Aprobación",
    actividades_teoricas: "Fundamentos de ciberseguridad • Tipos de ataques",
    actividades_practicas: "Simulación de hacking • Análisis de vulnerabilidades",
    impacto_esperado: "Mejorar las competencias de seguridad informática",
    vision_largo_plazo: "Fortalecer la formación tecnológica"
  };
  const data = { ...defaults, ...values };
  return PLAN_TABLE_COLUMNS.map((column) => data[column] ?? "").join("\t");
}

function run() {
  const tsv = `\`\`\`tsv\n${header}\n${row()}\n${row({
    nombre_capacitacion: "Inteligencia Artificial Generativa Aplicada a la Educación",
    horas: "150",
    fecha_inicio: "septiembre de 2024",
    fecha_fin: "octubre de 2024",
    actividades_teoricas: "Fundamentos de IA • Herramientas generativas",
    actividades_practicas: "Creación de recursos • Uso de IA en el aula"
  })}\n\`\`\``;

  const parsedRows = parseTsvRows(tsv);
  assert.strictEqual(parsedRows.length, 2);

  const result = parsePlanTable(tsv);
  assert.strictEqual(result.rows, 2);
  assert.strictEqual(result.plans, 1);
  assert.strictEqual(result.trainings, 2);
  assert.strictEqual(result.records[0].estado, "COMPLETO");
  assert.strictEqual(result.records[0].docente.tiempo_dedicacion, "Tiempo Completo");
  assert.strictEqual(result.records[0].archivo.metodo_lectura, "TABLA");
  assert.strictEqual(result.records[0].capacitaciones[0].horas, 70);
  assert.deepStrictEqual(result.records[0].capacitaciones[0].actividades_teoricas, [
    "Fundamentos de ciberseguridad",
    "Tipos de ataques"
  ]);

  const missing = parsePlanTable(`${header}\n${row({
    codigo_documento: "NO ENCONTRADO",
    periodo_plan: "NO ENCONTRADO",
    nombre_capacitacion: "NO ENCONTRADO",
    horas: "NO ENCONTRADO",
    fecha_inicio: "NO ENCONTRADO",
    fecha_fin: "NO ENCONTRADO",
    tipo_capacitacion: "NO ENCONTRADO",
    actividades_teoricas: "NO ENCONTRADO",
    actividades_practicas: "NO ENCONTRADO",
    impacto_esperado: "NO ENCONTRADO",
    vision_largo_plazo: "NO ENCONTRADO"
  })}`);
  assert.strictEqual(missing.records[0].estado, "REVISAR");
  assert.ok(missing.records[0].problemas_campos["docente.codigo_documento"]);
  assert.ok(missing.records[0].problemas_campos.capacitaciones);

  const conflict = parsePlanTable(`${header}\n${row()}\n${row({ carrera: "Redes y Telecomunicaciones", nombre_capacitacion: "Normas APA 7" })}`);
  assert.strictEqual(conflict.records[0].estado, "REVISAR");
  assert.ok(conflict.records[0].problemas_campos["docente.carrera"]);

  assert.throws(
    () => parseTsvRows(`archivo_pdf|codigo_documento\nplan.pdf|CODIGO`),
    /formato Markdown/i
  );

  console.log("Importación TSV de planes: pruebas correctas.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
