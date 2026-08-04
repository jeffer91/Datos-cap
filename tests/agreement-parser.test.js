"use strict";

const assert = require("assert");
const {
  extractAgreementCode,
  extractPeriod,
  parseSpanishDate,
  extractVersion,
  extractSupport,
  parseAgreementText
} = require("../src/agreement-parser");
const { matchTraining } = require("../src/agreement-ipc");

const digital = `
ACUERDO DE PATROCINIO INSTITUCIONAL
DOCENTE: FLORES CAHUEÑAS VIVIANA MATILDE
DESARROLLO DE SOFTWARE
CAPACITACIÓN: ETHICAL HACKING
Código: CGC-RGI2-159-PRO-134-2024-11
Fecha de Elaboración: noviembre-2024 Versión: 1.0
En la ciudad de Quito, a los 08 días del mes de 11 de 2024, el/la señor(a) FLORES CAHUEÑAS VIVIANA MATILDE, con número de cédula 1721776720, quien en lo sucesivo se denominará “El Colaborador”.
El Colaborador actualmente se encuentra vinculado(a) como Docente en el ITSQMET.
El patrocinio institucional comprende los siguientes:
Financiamiento total del costo del curso
Financiamiento parcial del costo del curso (indicar porcentaje: ___%)
Anticipo de sueldos/honorarios
Cambio temporal en modalidad de trabajo X
Licencia con remuneración
Licencia sin remuneración
Ajuste de horario laboral
COMPROMISOS DEL COLABORADOR
`;

const newTemplate = `
Acuerdo de Patrocinio Institucional
Docente: Quishpe Torres William Rosendo
Carrera: Seguridad Ciudadana y Orden Público
Capacitación: Técnico en seguridad física y del entorno
Elaborado por: Quishpe Torres William Rosendo
Código: UGPA-RGI2-69-PRO￾134-2026-03
En la ciudad de Quito, a los 01 días del mes de Marzo de 2026, el/la señor(a) Quishpe Torres William Rosendo, con número de cédula 1712081452.
El Colaborador actualmente se encuentra vinculado(a) como Docente en el ITSQMET.
Apoyo Institucional Marcar
Financiamiento total del costo del curso X
Financiamiento parcial del costo del curso (indicar porcentaje: %)
Anticipo de sueldos/honorarios
Cambio temporal en modalidad de trabajo
Licencia con remuneración
Licencia sin remuneración
Ajuste de horario laboral
Compromisos
`;

function run() {
  assert.strictEqual(extractAgreementCode(digital), "CGC-RGI2-159-PRO-134-2024-11");
  assert.strictEqual(extractAgreementCode(newTemplate), "UGPA-RGI2-69-PRO-134-2026-03");
  assert.strictEqual(extractPeriod(extractAgreementCode(newTemplate)), "2026-03");
  assert.deepStrictEqual(parseSpanishDate(digital), {
    iso: "2024-11-08",
    original: "En la ciudad de Quito, a los 08 días del mes de 11 de 2024"
  });
  assert.strictEqual(parseSpanishDate(newTemplate).iso, "2026-03-01");
  assert.strictEqual(extractVersion(digital), "1.0");

  const supportOld = extractSupport(digital);
  assert.strictEqual(supportOld.cambio_modalidad_trabajo, true);
  assert.strictEqual(supportOld.financiamiento_total, false);

  const supportNew = extractSupport(newTemplate);
  assert.strictEqual(supportNew.financiamiento_total, true);
  assert.strictEqual(supportNew.cambio_modalidad_trabajo, false);

  const record = parseAgreementText(digital, {
    fileName: "CGC-RGI2-159-PRO-134-2024-11.pdf",
    filePath: "C:/acuerdos/acuerdo.pdf",
    hash: "abc",
    pages: 4,
    method: "DIGITAL"
  });
  assert.strictEqual(record.docente.cedula, "1721776720");
  assert.strictEqual(record.docente.nombre, "Flores Cahueñas Viviana Matilde");
  assert.strictEqual(record.docente.carrera, "Desarrollo de Software");
  assert.strictEqual(record.docente.cargo, "Docente");
  assert.strictEqual(record.capacitacion.nombre, "Ethical Hacking");
  assert.strictEqual(record.acuerdo.version_plantilla, "1.0");
  assert.strictEqual(record.acuerdo.estado_acuerdo, "PENDIENTE_FIRMA");
  assert.strictEqual(record.estado, "REVISAR");

  const linked = matchTraining(record, [{
    id: "cap-001",
    planId: "plan-001",
    teacher: "Viviana Matilde Flores Cahueñas",
    career: "Desarrollo de Software",
    period: "2024-11",
    name: "Ethical Hacking"
  }]);
  assert.strictEqual(linked.capacitacion.id_plan, "cap-001");
  assert.strictEqual(linked.capacitacion.vinculada, true);

  const scanned = parseAgreementText(newTemplate, {
    fileName: "UGPA-R~3.PDF",
    filePath: "C:/acuerdos/UGPA-R~3.PDF",
    pages: 4,
    method: "OCR"
  });
  assert.strictEqual(scanned.acuerdo.estado_acuerdo, "FIRMADO");
  assert.strictEqual(scanned.patrocinio.financiamiento_total, true);

  console.log("Extractor de acuerdos: pruebas correctas.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
