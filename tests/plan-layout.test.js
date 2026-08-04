"use strict";

const assert = require("assert");
const {
  parseTableFromWords,
  parseActivities,
  assignActivities,
  applyLayoutToPlan
} = require("../src/plan-layout");

function word(text, left, top, width = 60, height = 18) {
  return {
    text,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    confidence: 90
  };
}

function addRow(words, number, y, name, hours, dateWords, type = "Aprobación") {
  words.push(word(String(number), 35, y, 18));
  let x = 125;
  name.split(" ").forEach((token) => {
    words.push(word(token, x, y, Math.max(35, token.length * 8)));
    x += Math.max(42, token.length * 8 + 8);
  });
  words.push(word(String(hours), 490, y, 34));
  x = 610;
  dateWords.split(" ").forEach((token, index) => {
    const lineTop = index > 4 ? y + 20 : y;
    const lineIndex = index > 4 ? index - 5 : index;
    words.push(word(token, 610 + lineIndex * 55, lineTop, Math.max(35, token.length * 7)));
  });
  words.push(word(type, 835, y, 110));
}

function run() {
  const words = [];
  addRow(words, 1, 120, "Ethical Hacking", 70, "Desde noviembre del 2024 hasta diciembre del 2024");
  addRow(words, 2, 220, "Normas APA 7 Gamificación Educativa", 50, "Desde octubre del 2024 hasta noviembre del 2024");
  addRow(words, 3, 320, "Inteligencia Artificial Generativa Aplicada a la Educación", 150, "Desde septiembre del 2024 hasta octubre del 2024");
  addRow(words, 4, 420, "Valores y Habilidades Blandas", 40, "Desde julio del 2025 hasta agosto del 2025");

  const table = {
    rectangle: { left: 0, top: 0, width: 1000, height: 560 },
    words
  };
  const trainings = parseTableFromWords(table);
  assert.strictEqual(trainings.length, 4);
  assert.strictEqual(trainings[0].nombre, "Ethical Hacking");
  assert.strictEqual(trainings[0].horas, 70);
  assert.strictEqual(trainings[0].fecha_inicio_propuesta, "noviembre del 2024");
  assert.strictEqual(trainings[0].fecha_fin_propuesta, "diciembre del 2024");
  assert.strictEqual(trainings[2].horas, 150);

  const layout = {
    headers: [],
    codeRegions: [{ text: "Código UGPA-RGI2-07-PRO-251-2024-10" }],
    tables: [table],
    sections: {
      activities: [{
        text: `6. Actividades\nTeóricas\n- Ciberseguridad\n- IA Generativa\n- Normas APA 7\n- Valores Educativos\nPrácticas\n- Simulaciones de hacking\n- Uso de IA en aula\n- Aplicación de normas APA\n- Dinámicas de valores`
      }],
      impact: [{ text: "7. Impacto esperado en el docente\nMejorar competencias en IA, ciberseguridad, normas y valores educativos" }],
      vision: [{ text: "8. Visión a largo plazo (3 a 5 años)\nFortalecer la innovación pedagógica con apoyo de IA y TIC" }]
    }
  };

  const activities = parseActivities(layout);
  assert.deepStrictEqual(activities.theoretical, [
    "Ciberseguridad",
    "IA Generativa",
    "Normas APA 7",
    "Valores Educativos"
  ]);
  const linked = assignActivities(trainings, activities);
  assert.deepStrictEqual(linked[0].actividades_teoricas, ["Ciberseguridad"]);
  assert.deepStrictEqual(linked[0].actividades_practicas, ["Simulaciones de hacking"]);
  assert.deepStrictEqual(linked[2].actividades_teoricas, ["IA Generativa"]);

  const record = {
    id: "plan-1",
    archivo: { nombre: "UGDC45~1.PDF", ruta: "C:/planes/UGDC45~1.PDF", metodo_lectura: "OCR" },
    docente: {
      nombre: "Verónica Marcela Zapata Yanez",
      carrera: "Desarrollo de Software",
      tiempo_dedicacion: "Tiempo Completo",
      nivel_academico_actual: "Maestría",
      codigo_documento: "",
      periodo_plan: ""
    },
    diagnostico: {
      capacitacion_12_meses: "Fundamentos de Python",
      avances_aplicados: "Spring Boot",
      comodidad_metodologias: "Muy cómodo",
      estrategias_pedagogicas: "Uso de TICS",
      herramientas_tecnologicas: "Java, Postgres, Oracle, MySQL y JavaScript",
      formacion_adicional: "Doctorado en Ciencias de la Computación",
      tipo_formacion: "Específica 3. Evaluaciones de capacitación texto institucional"
    },
    capacitaciones: [{ nombre: "Lectura incorrecta", horas: 12 }],
    estado: "REVISAR",
    advertencias: [],
    campos_faltantes: []
  };

  const enhanced = applyLayoutToPlan(record, layout);
  assert.strictEqual(enhanced.docente.codigo_documento, "UGPA-RGI2-07-PRO-251-2024-10");
  assert.strictEqual(enhanced.docente.periodo_plan, "2024-10");
  assert.strictEqual(enhanced.capacitaciones.length, 4);
  assert.strictEqual(enhanced.capacitaciones[3].nombre, "Valores y Habilidades Blandas");
  assert.strictEqual(enhanced.diagnostico.tipo_formacion, "Específica");
  assert.strictEqual(enhanced.capacitaciones[0].impacto_esperado, "Mejorar competencias en IA, ciberseguridad, normas y valores educativos");
  assert.strictEqual(enhanced.ocr_estructurado.aplicado, true);

  console.log("OCR estructurado de planes: pruebas correctas.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
