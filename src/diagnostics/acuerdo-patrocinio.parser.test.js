/* =========================================================
Nombre completo: acuerdo-patrocinio.parser.test.js
Ruta o ubicación: /src/diagnostics/acuerdo-patrocinio.parser.test.js
Función o funciones:
- Probar el parser de Acuerdos de Patrocinio Institucional.
- Verificar docente, cédula, carrera, capacitación, fecha y apoyo marcado.
- Confirmar responsables y construcción de las cuatro tablas.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createSyntheticAgreementDocument() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-RGI2-56-PRO-134-2026-03-Luis-Enrique-Yulan-Mendoza_firmado.pdf",
    fileName: "UGPA-RGI2-56-PRO-134-2026-03-Luis-Enrique-Yulan-Mendoza_firmado.pdf",
    fileHash: "hash-sintetico-acuerdo-patrocinio",
    pageCount: 3,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
ACUERDO DE PATROCINIO INSTITUCIONAL
DOCENTE: Luis Enrique Yulan Mendoza
Carrera: Redes y Telecomunicaciones
CAPACITACIÓN: Especialización en Redes de Fibra Optica
UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS
Código:
UGPA-RGI2-56-PRO￾134-2026-03
Acuerdo de Patrocinio Institucional
Docente: Luis Enrique Yulan Mendoza
Carrera: Redes y Telecomunicaciones
Capacitación: Especialización en Redes de Fibra Optica
ELABORADO POR: APROBADO POR:
NOMBRE: Luis Enrique Yulan Mendoza
NOMBRE: Msc. Jefferson Villarreal
CARGO: Docente CARGO: Coordinador de Carreras
Página 1 de 3

ACUERDO DE PATROCINIO INSTITUCIONAL
Instituto Tecnológico Superior Quito Metropolitano (ITSQMET)
En la ciudad de Quito, a los 01 días del mes de Marzo de 2026, el/la señor(a) Luis Enrique Yulan Mendoza, con número de cédula 0705281053, quien en lo sucesivo se denominará “El Colaborador”, acuerda suscribir con el Instituto Tecnológico Superior Quito Metropolitano (ITSQMET) el presente acuerdo de patrocinio institucional conforme a las siguientes declaraciones y cláusulas:
ANTECEDENTES
El Colaborador actualmente se encuentra vinculado(a) como Docente en el ITSQMET. El ITSQMET, en el marco de su política de patrocinio institucional, considera oportuno impulsar la participación de El Colaborador en la capacitación Especialización en Redes de Fibra Optica, con el objetivo de contribuir a su desarrollo profesional y fortalecer las competencias requeridas en su labor académica.
El patrocinio institucional comprende los siguientes:
Apoyo Institucional Marcar
Financiamiento total del costo del curso X
Financiamiento parcial del costo del curso (indicar porcentaje: ___%)
Anticipo de sueldos/honorarios
Cambio temporal en modalidad de trabajo
Licencia con remuneración
Licencia sin remuneración
Ajuste de horario laboral
COMPROMISOS DEL COLABORADOR
El Colaborador se compromete a cumplir las obligaciones institucionales.
`
  };
}

function runAgreementParserTest() {
  const processor = assertProcessor("acuerdo-patrocinio");
  const parseResult = processor.parseDocuments([createSyntheticAgreementDocument()]);

  assertCondition(parseResult.parsedCount === 1, "El parser no procesó el acuerdo sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const agreement = document.datos_acuerdo;
  const selectedSupports = document.apoyos.filter((row) => row.seleccionado === "SI");

  assertCondition(document.archivo.codigo_documento === "UGPA-RGI2-56-PRO-134-2026-03", "No se extrajo el código institucional.");
  assertCondition(document.archivo.periodo === "2026-03", "No se extrajo el periodo.");
  assertCondition(document.archivo.numero_registro === "56", "No se extrajo el número de registro.");
  assertCondition(agreement.nombre_docente === "Luis Enrique Yulan Mendoza", "No se extrajo el docente.");
  assertCondition(agreement.cedula_docente === "0705281053", "No se extrajo la cédula.");
  assertCondition(agreement.carrera === "Redes y Telecomunicaciones", "No se extrajo la carrera.");
  assertCondition(agreement.nombre_capacitacion === "Especialización en Redes de Fibra Optica", "No se extrajo la capacitación.");
  assertCondition(agreement.fecha_acuerdo === "2026-03-01", "No se normalizó la fecha del acuerdo.");
  assertCondition(selectedSupports.length === 1, "Debe existir exactamente un apoyo marcado.");
  assertCondition(selectedSupports[0].tipo_apoyo === "Financiamiento total del costo del curso", "No se detectó el financiamiento total.");
  assertCondition(document.responsables.length === 2, "No se extrajeron los dos responsables.");
  assertCondition(document.responsables[0].nombre_responsable === "Luis Enrique Yulan Mendoza", "No se extrajo el elaborador.");
  assertCondition(document.responsables[1].nombre_responsable === "Msc. Jefferson Villarreal", "No se extrajo el aprobador.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El acuerdo sintético produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const structureValidation = processor.validateTableResult(tableResult);

  assertCondition(structureValidation.ok, "La estructura de cuatro tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 4, "No se construyeron cuatro tablas.");
  assertCondition(tableResult.summary.rows_by_table.archivos_acuerdo_patrocinio === 1, "La tabla de archivos debe tener una fila.");
  assertCondition(tableResult.summary.rows_by_table.datos_acuerdo_patrocinio === 1, "La tabla de datos debe tener una fila.");
  assertCondition(tableResult.summary.rows_by_table.apoyos_acuerdo_patrocinio === 7, "La tabla de apoyos debe tener siete filas.");
  assertCondition(tableResult.summary.rows_by_table.responsables_acuerdo_patrocinio === 2, "La tabla de responsables debe tener dos filas.");

  return {
    ok: true,
    documentId: document.id_documento,
    codigoDocumento: document.archivo.codigo_documento,
    docente: agreement.nombre_docente,
    capacitacion: agreement.nombre_capacitacion,
    apoyoMarcado: selectedSupports[0].tipo_apoyo,
    responsables: document.responsables.length,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    const result = runAgreementParserTest();
    console.log("ACUERDO_PATROCINIO_PARSER_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("ACUERDO_PATROCINIO_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  createSyntheticAgreementDocument,
  runAgreementParserTest
};
