/* =========================================================
Nombre completo: planificacion-curso.parser.test.js
Ruta o ubicación: /src/diagnostics/planificacion-curso.parser.test.js
Función o funciones:
- Probar el parser de Planificación de Capacitación por Curso.
- Verificar datos generales, opciones, unidades, horas y evaluaciones.
- Confirmar la construcción de las cuatro tablas del módulo.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createSyntheticPlanningDocument() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-RGI1-01-PRO-134-2025-11-Curso-Demo.pdf",
    fileName: "UGPA-RGI1-01-PRO-134-2025-11-Curso-Demo.pdf",
    fileHash: "hash-sintetico-planificacion-curso",
    pageCount: 12,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS
Código: UGPA-RGI1-01-PRO-134-2025-11
Versión: 1.0
Fecha de Elaboración: 1-Noviembre-2025
Planificación De Capacitación: Desarrollo de Contenidos de Aprendizaje, Dirigido A Todas Las Carreras

ELABORADO POR:
NOMBRE: MSc. Jefferson Villarreal
CARGO: COORDINADOR DE CARRERAS
REVISADO POR:
NOMBRE: Ing. Martha Tomalá
CARGO: COORDINADORA GENERAL DE CARRERAS
APROBADO POR:
NOMBRE: Dr. Alex León T.
CARGO: VICERRECTOR

1. NOMBRE DEL CURSO:
Desarrollo de Contenidos de Aprendizaje

2. DESCRIPCIÓN DEL CURSO:
Curso orientado al diseño de contenidos educativos claros, pertinentes e innovadores mediante herramientas digitales y estrategias de aprendizaje activo.

3. FORMA DE EJECUCIÓN (Seleccionar según corresponda)
X CURSO
SEMINARIO
TALLER
CONFERENCIA
OTRA

4. TIPO DE CAPACITACIÓN (marcar la que corresponda)
CAPACITACIÓN CONCRETA ESPECÍFICA
X CAPACITACIÓN INTELECTUAL GENÉRICA

5. CARÁCTER (Seleccionar según corresponda)
X NACIONAL
INTERNACIONAL

6. MODALIDAD (Seleccionar según corresponda)
PRESENCIAL
SEMI PRESENCIAL
X VIRTUAL
HÍBRIDA

7. TIPO DE CERTIFICADO QUE CONCEDERÁ
X APROBACIÓN
PARTICIPACIÓN

8. DIRIGIDO A
Docentes del Instituto Superior Tecnológico Quito Metropolitano pertenecientes a todas las carreras.

9. ARTICULACIÓN DEL CURSO
Objetivo estratégico institucional relacionado con el fortalecimiento del claustro docente.

10. OBJETIVOS GENERALES DEL CURSO (RESULTADOS O LOGROS DE APRENDIZAJE DEL CURSO)
Fortalecer las competencias pedagógicas, tecnológicas y metodológicas para diseñar contenidos de aprendizaje innovadores y aplicables a la práctica docente.

11. TÓPICOS O TEMAS CUBIERTOS
TEMÁTICA CONTENIDO HORAS TEÓRICAS HORAS PRÁCTICA TRABAJO AUTÓNOMO LOGRO DE APRENDIZAJE

Unidad 1:
Fundamentos del aprendizaje digital
Plataformas educativas
Normas SCORM
Ética y propiedad intelectual
6 4 5
Los participantes comprenderán los fundamentos del aprendizaje digital y aplicarán criterios éticos en el desarrollo de contenidos.

Unidad 2:
Proceso de diseño de contenidos
Identificación de necesidades
Planificación del curso
Elaboración de infografías y storyboard
6 6 3
Los participantes diseñarán recursos educativos contextualizados mediante elementos multimedia y planificación instruccional.

12. AMBIENTES DE APRENDIZAJE
Aula virtual y plataforma institucional.

13. EVALUACIÓN DEL CURSO
PARÁMETROS DE EVALUACIÓN TEMÁTICA NÚMERO DE INSTRUMENTOS DE EVALUACIÓN
Exposiciones u Otros 1
Trabajo Grupal 1
Trabajo de Investigación 2
Evaluación parcial 2
Evaluación final 2
Otros (especificar) 2

14. FACILITADOR DE LA CAPACITACIÓN
NOMBRE: Facilitador Demo
CARGO: Docente capacitador

15. ANEXOS
Evidencias del curso.
`
  };
}

function runPlanningParserTest() {
  const processor = assertProcessor("planificacion-curso");
  const parseResult = processor.parseDocuments([createSyntheticPlanningDocument()]);

  assertCondition(parseResult.parsedCount === 1, "El parser no procesó la planificación sintética.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const general = document.datos_generales;

  assertCondition(document.archivo.codigo_documento === "UGPA-RGI1-01-PRO-134-2025-11", "No se extrajo el código PRO-134.");
  assertCondition(document.archivo.periodo === "2025-11", "No se extrajo el periodo.");
  assertCondition(general.nombre_curso === "Desarrollo de Contenidos de Aprendizaje", "No se extrajo el nombre del curso.");
  assertCondition(general.forma_ejecucion === "CURSO", "No se detectó la forma de ejecución marcada.");
  assertCondition(general.tipo_capacitacion === "CAPACITACIÓN INTELECTUAL GENÉRICA", "No se detectó el tipo de capacitación.");
  assertCondition(general.caracter_capacitacion === "NACIONAL", "No se detectó el carácter nacional.");
  assertCondition(general.modalidad === "VIRTUAL", "No se detectó la modalidad virtual.");
  assertCondition(general.tipo_certificado === "APROBACIÓN", "No se detectó el certificado de aprobación.");
  assertCondition(document.unidades.length === 2, "No se extrajeron las dos unidades.");
  assertCondition(general.total_horas === 30, "La suma de horas del curso no es correcta.");
  assertCondition(document.evaluaciones.length === 6, "No se extrajeron los seis parámetros de evaluación.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "La planificación sintética produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const structureValidation = processor.validateTableResult(tableResult);

  assertCondition(structureValidation.ok, "La estructura de cuatro tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 4, "No se construyeron cuatro tablas.");
  assertCondition(tableResult.summary.rows_by_table.unidades_capacitacion === 2, "La tabla de unidades no contiene dos filas.");
  assertCondition(tableResult.summary.rows_by_table.evaluaciones_capacitacion === 6, "La tabla de evaluaciones no contiene seis filas.");

  return {
    ok: true,
    documentId: document.id_documento,
    codigoDocumento: document.archivo.codigo_documento,
    curso: general.nombre_curso,
    modalidad: general.modalidad,
    totalHoras: general.total_horas,
    unidades: document.unidades.length,
    evaluaciones: document.evaluaciones.length,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    const result = runPlanningParserTest();
    console.log("PLANIFICACION_CURSO_PARSER_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("PLANIFICACION_CURSO_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  createSyntheticPlanningDocument,
  runPlanningParserTest
};
