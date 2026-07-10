/* =========================================================
Nombre completo: plan-individual.parser.test.js
Ruta o ubicación: /src/diagnostics/plan-individual.parser.test.js
Función o funciones:
- Probar el parser modular del Plan Individual con texto controlado.
- Confirmar extracción de código, docente, carrera y periodo.
- Verificar que se generen las cinco tablas esperadas.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createSyntheticPdfDocument() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-RGI1-01-PRO-251-2026-03-Docente Demo.pdf",
    fileName: "UGPA-RGI1-01-PRO-251-2026-03-Docente Demo.pdf",
    fileHash: "hash-sintetico-plan-individual",
    pageCount: 5,
    errors: [],
    warnings: [],
    text: `
Código: UGPA-RGI1-01-PRO-251-2026-03
DOCENTE: Docente Demo CARRERA: Desarrollo de Software
Tiempo de Dedicación Tiempo Completo
Función Sustantiva Docencia
Capacidades actuales del docente
Curso de actualización últimos 12 meses Innovación educativa
Avances disciplinares aplicados Inteligencia artificial aplicada
Comodidad metodologías nuevas Alta
Estrategias pedagógicas Aprendizaje basado en proyectos
Herramientas tecnológicas Moodle, Teams y Canva
Formación adicional necesaria Analítica educativa
Nivel académico actual Maestría
Tipo de formación Específica
Capacitaciones propuestas
Curso Demo de Innovación Educativa 40 horas 01/03/2026 al 31/03/2026 Aprobación
Formación Docente
Situación actual Maestría
Situación propuesta Doctorado
Tiempo esperado 24 meses
Doctorado en Educación e Innovación Específica
APROBADO:
NOMBRE: Gestor Demo
CARGO: Gestor de Procesos Académicos
`
  };
}

function runParserRegressionTest() {
  const processor = assertProcessor("plan-individual");
  const parseResult = processor.parseDocuments([createSyntheticPdfDocument()]);

  assertCondition(parseResult.parsedCount === 1, "El parser modular no procesó el documento sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser modular produjo errores inesperados.");

  const document = parseResult.parsed[0];
  assertCondition(Boolean(document.id_documento), "No se generó id_documento.");
  assertCondition(document.archivo.codigo_documento === "UGPA-RGI1-01-PRO-251-2026-03", "No se extrajo el código documental.");
  assertCondition(document.archivo.periodo === "2026-03", "No se extrajo el periodo.");
  assertCondition(document.identificacion.nombre_docente === "Docente Demo", "No se extrajo el docente.");
  assertCondition(document.identificacion.carrera === "Desarrollo de Software", "No se extrajo la carrera.");

  const tableResult = processor.buildTables(parseResult);
  const structureValidation = processor.validateTableResult(tableResult);

  assertCondition(structureValidation.ok, "Las tablas no cumplen la estructura esperada.");
  assertCondition(tableResult.summary.total_tables === 5, "No se generaron cinco tablas.");

  return {
    ok: true,
    documentId: document.id_documento,
    codigoDocumento: document.archivo.codigo_documento,
    periodo: document.archivo.periodo,
    docente: document.identificacion.nombre_docente,
    carrera: document.identificacion.carrera,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    const result = runParserRegressionTest();
    console.log("PLAN_INDIVIDUAL_PARSER_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("PLAN_INDIVIDUAL_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  createSyntheticPdfDocument,
  runParserRegressionTest
};
