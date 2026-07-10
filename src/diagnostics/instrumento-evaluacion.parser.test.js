/* =========================================================
Nombre completo: instrumento-evaluacion.parser.test.js
Ruta o ubicación: /src/diagnostics/instrumento-evaluacion.parser.test.js
Función o funciones:
- Probar el parser del Instrumento de Evaluación de la Capacitación.
- Verificar datos, participantes, indicadores, Likert, objetivos y responsables.
- Confirmar la construcción de las ocho tablas del módulo.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createSyntheticEvaluationInstrument() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-RGI1-01-PRO-135-2025-09-Educacion-financiera.pdf",
    fileName: "UGPA-RGI1-01-PRO-135-2025-09-Educacion-financiera.pdf",
    fileHash: "hash-sintetico-instrumento-evaluacion",
    pageCount: 7,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
Instrumento de evaluación de la capacitación: Educación Financiera, Dirigido A La Carrera de Administración
UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS
Código: UGPA-RGI1-01-PRO￾135-2025-09
Versión: 1.0
Fecha de Elaboración: 26-septiembre-2025
Página 1 de 7
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: Msg. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: COORDINADOR DE CARRERAS CARGO: COORDINADORA GENERAL DE CARRERAS CARGO: VICERRECTOR

1. Datos Generales
NOMBRE DEL CURSO: Educación Financiera
PERÍODO DE LA CAPACITACIÓN: Agosto 2025 – Septiembre 2025
NOMBRE DEL/LOS FACILITADOR(ES): Plataforma ITSQMET
FECHA DE ELABORACIÓN: 26 de septiembre de 2025

2. MATRIZ CON LOS DATOS DE LOS PARTICIPANTES
# Nombres y Apellidos Cédula de Identidad Tiene discapacidad Tipo de discapacidad posee carné de discapacidad Género SI NO SI NO
1 Jorge Roberto Uquillas Erazo 1715182562 X X M
2 José Sebastián Zambrano Urgilez 0302155221 X X M
3 Katherine Lorena Sanguña Carrera 1724525785 X X F

3. Resultados de Evaluación
A. Evaluación del Uso de Recursos y Metodología (Cuantitativa)
Cumplimiento del Cronograma Porcentaje de sesiones realizadas según el plan 100 % Sin observaciones
Participación Activa Número de participantes activos 3 Sin observaciones
Uso de Recursos Tecnológicos Porcentaje de recursos utilizados eficientemente 100 % Sin observaciones
Aplicación de la Metodología Número de actividades ejecutadas con la metodología planeada 8 Evaluaciones
Adaptabilidad del Facilitador Número de ajustes realizados por el facilitador 3 Modalidad virtual
B. Evaluación de Resultados Cuantitativos
Evaluación del Aprendizaje Promedio de calificaciones obtenidas 9/10 Sin observaciones
Satisfacción de Participantes Número de participantes satisfechos 3 Sin observaciones
Resultados Finales Tasa de aprobación 100 % Sin observaciones
Aplicabilidad de Conocimientos Porcentaje de participantes que aplican lo aprendido 100 % Sin observaciones
Seguimiento Post-Curso Número de participantes que han recibido seguimiento 0 Sin observaciones

B. Evaluación Cualitativa con Escala de Likert
Claridad de los Contenidos Muy de acuerdo X
Relevancia del Material Muy de acuerdo X
Metodología Utilizada De acuerdo X
Interacción del Facilitador Muy de acuerdo X
Satisfacción General Muy de acuerdo X

C. Cumplimiento de los Objetivos de Aprendizaje
Comprender los Conceptos Clave del Tema 100 % Los contenidos fueron comprendidos.
Aplicar Conocimientos en Casos Prácticos 100 % Los participantes resolvieron casos prácticos.
Desarrollar Habilidades de Presentación 90 % La modalidad virtual limitó algunas presentaciones.

D. Evaluación de Resultados Cualitativos
Los participantes valoraron positivamente la claridad, utilidad y aplicación del curso.
OBSERVACIONES GENERALES:
El curso se ejecutó de acuerdo con el cronograma previsto.
CONCLUSIONES:
La capacitación alcanzó los resultados esperados y fortaleció conocimientos financieros.
RECOMENDACIONES:
Mantener actividades prácticas y realizar seguimiento posterior.
ANEXOS:
Página 2 de 7 Página 3 de 7 Página 4 de 7 Página 5 de 7 Página 6 de 7 Página 7 de 7
`
  };
}

function runEvaluationInstrumentParserTest() {
  const processor = assertProcessor("instrumento-evaluacion");
  const parseResult = processor.parseDocuments([createSyntheticEvaluationInstrument()]);
  assertCondition(parseResult.parsedCount === 1, "No se procesó el instrumento sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const general = document.datos_generales;
  assertCondition(document.archivo.codigo_documento === "UGPA-RGI1-01-PRO-135-2025-09", "No se extrajo el código PRO-135.");
  assertCondition(document.archivo.periodo === "2025-09", "No se extrajo el periodo.");
  assertCondition(document.archivo.inconsistencia_paginas === "NO", "Se detectó una inconsistencia de páginas inexistente.");
  assertCondition(general.nombre_curso === "Educación Financiera", "No se extrajo el curso.");
  assertCondition(general.facilitador === "Plataforma ITSQMET", "No se extrajo el facilitador.");
  assertCondition(general.fecha_elaboracion === "2025-09-26", "No se normalizó la fecha.");
  assertCondition(general.carrera_publico === "Administración", "No se extrajo la carrera.");
  assertCondition(document.participantes.length === 3, "No se extrajeron tres participantes.");
  assertCondition(document.indicadores.length === 10, "No se construyeron diez indicadores.");
  assertCondition(document.indicadores.every((row) => row.resultado_texto !== ""), "Existen indicadores sin resultado.");
  assertCondition(document.likert.length === 5, "No se construyeron cinco ítems Likert.");
  assertCondition(document.likert.every((row) => row.escala_likert !== ""), "No se reconocieron las escalas Likert explícitas.");
  assertCondition(document.objetivos.length === 3, "No se extrajeron tres objetivos.");
  assertCondition(general.promedio_cumplimiento_objetivos === 96.67, "El promedio de objetivos es incorrecto.");
  assertCondition(document.analisis.conclusiones.includes("alcanzó"), "No se extrajeron conclusiones.");
  assertCondition(document.analisis.recomendaciones.includes("seguimiento"), "No se extrajeron recomendaciones.");
  assertCondition(document.responsables.length === 3, "No se extrajeron tres responsables.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El instrumento sintético produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const structureValidation = processor.validateTableResult(tableResult);
  assertCondition(structureValidation.ok, "La estructura de ocho tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 8, "No se construyeron ocho tablas.");
  assertCondition(tableResult.summary.rows_by_table.indicadores_instrumento_evaluacion === 10, "La tabla de indicadores no contiene diez filas.");
  assertCondition(tableResult.summary.rows_by_table.likert_instrumento_evaluacion === 5, "La tabla Likert no contiene cinco filas.");

  return {
    ok: true,
    documentId: document.id_documento,
    curso: general.nombre_curso,
    participantes: document.participantes.length,
    indicadores: document.indicadores.length,
    objetivos: document.objetivos.length,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    console.log("INSTRUMENTO_EVALUACION_PARSER_OK");
    console.log(JSON.stringify(runEvaluationInstrumentParserTest(), null, 2));
  } catch (error) {
    console.error("INSTRUMENTO_EVALUACION_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { createSyntheticEvaluationInstrument, runEvaluationInstrumentParserTest };
