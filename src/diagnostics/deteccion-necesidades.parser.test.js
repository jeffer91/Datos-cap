/* =========================================================
Nombre completo: deteccion-necesidades.parser.test.js
Ruta o ubicación: /src/diagnostics/deteccion-necesidades.parser.test.js
Función o funciones:
- Probar el parser del documento único Detección de Necesidades.
- Verificar fuentes, necesidades institucionales, recurrencias y prioridades.
- Confirmar la construcción de nueve tablas y la regla de archivo único.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createSyntheticNeedsDetection() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-RGI1-01-PRO-70-2025-10-Deteccion-Necesidades.pdf",
    fileName: "UGPA-RGI1-01-PRO-70-2025-10-Deteccion-Necesidades.pdf",
    fileHash: "hash-sintetico-deteccion-necesidades",
    pageCount: 110,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
Unidad de Gestión de Procesos Académicos
Código: UGPA-RGI1-01-PRO￾70-2025-10
Versión: 1.0
Fecha de Elaboración: 02 - octubre - 2025
Detección de Necesidades de Capacitación. Octubre 2025 – Marzo 2026
Página 1 de 110
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: MSc. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: COORDINADOR DE TITULACIÓN Y EFICIENCIA TERMINAL CARGO: COORDINADORA GENERAL DE CARRERAS CARGO: VICERRECTOR

1. Introducción
1.4. Objetivos del Diagnóstico:
Objetivo general: identificar y priorizar las necesidades de capacitación docente.
Objetivos específicos: consolidar evidencias institucionales y definir prioridades por carrera.

2. Base Legal
Normativa institucional aplicable.

4. Metodología del Diagnóstico:
Se aplicaron encuestas institucionales mediante Microsoft Forms, cuestionarios a coordinadores, entrevistas a docentes, reuniones académicas y análisis de PEAs. Se obtuvieron un total de 125 respuestas válidas.

5. Resultados del Diagnóstico
5.2. Capacitación Genérica Institucional
La selección de la capacitación genérica institucional “Desarrollador de Contenidos de Aprendizaje” es el resultado del diagnóstico.
Tabla 1 Necesidades a nivel institucional
Necesidad de capacitación identificada Presencia institucional Porcentaje de recurrencia
Desarrollo de contenidos de aprendizaje Muy alta 68 %
Estrategias metodológicas activas Alta 54 %
Evaluación por resultados de aprendizaje Media 47 %
Uso pedagógico de herramientas digitales Media 43 %
Planificación curricular por competencias Media 39 %
Interpretación técnica:
La primera necesidad presenta el mayor nivel de recurrencia institucional.

Tabla 2 Necesidades de capacitación identificadas – Gestión del Talento Humano
N.º Necesidad de capacitación identificada Tipo de necesidad Nivel de recurrencia
1 Estrategia analítica y gestión del talento humano Disciplinar Alta
2 Diseño de contenidos de aprendizaje Pedagógica Alta
3 Metodologías activas aplicadas a la gestión del talento Pedagógica Media
4 Uso de herramientas digitales para análisis de datos en RR.HH. Tecnológica Media
5 Evaluación por competencias en entornos organizacionales Pedagógica Media
Tabla 3 Análisis cuantitativo de recurrencia
Necesidad Porcentaje de recurrencia
Estrategia analítica y gestión del talento humano 72 %
Diseño de contenidos de aprendizaje 65 %
Metodologías activas aplicadas a la gestión del talento 49 %
Uso de herramientas digitales para análisis de datos en RR.HH. 44 %
Evaluación por competencias en entornos organizacionales 38 %
Interpretación:
La primera necesidad tiene mayor recurrencia.
Análisis cualitativo
Los docentes requieren integrar analítica y decisiones basadas en datos.
5.2.5.2. Vinculación de la capacitación prioritaria con la carrera
La capacitación prioritaria para la carrera de Gestión del Talento Humano corresponde a:
Estrategia Analítica y Gestión del Talento Humano
Tabla 4 Vinculación de la capacitación prioritaria con la carrera
Aspecto Vinculación con la carrera
Perfil de egreso Fortalece competencias de gestión estratégica
Competencias declaradas Analítica y toma de decisiones
Impacto en la docencia Mejora la aplicación de casos organizacionales
Pertinencia curricular Muy alta
Alineación institucional Coherente con objetivos académicos y de calidad
Relación con la capacitación genérica institucional Se articula con Desarrollador de Contenidos de Aprendizaje.

Tabla 5 Necesidades de capacitación identificadas – Enfermería
N.º Necesidad de capacitación identificada Tipo de necesidad Nivel de recurrencia
1 Manejo clínico del recién nacido Disciplinar–clínica Alta
2 Diseño de contenidos para procedimientos clínicos Pedagógica Alta
3 Seguridad del paciente Disciplinar Media
4 Simulación clínica Pedagógica–práctica Media
5 Recursos tecnológicos para salud Tecnológica Media
Tabla 6 Análisis cuantitativo de recurrencia
Necesidad Porcentaje de recurrencia
Manejo clínico del recién nacido 79 %
Diseño de contenidos para procedimientos clínicos 70 %
Seguridad del paciente 58 %
Simulación clínica 51 %
Recursos tecnológicos para salud 44 %
Interpretación:
La actualización neonatal presenta mayor recurrencia.
Análisis cualitativo
Los docentes requieren actualización clínica y mediación pedagógica.
5.2.12.2. Vinculación de la capacitación prioritaria con la carrera
La capacitación prioritaria para la carrera de Enfermería corresponde a:
Manejo Clínico del Recién Nacido
Tabla 7 Vinculación de la capacitación prioritaria con la carrera
Aspecto Vinculación con la carrera
Perfil de egreso Fortalece competencias clínicas
Competencias declaradas Atención neonatal segura
Impacto en la docencia Mejora la mediación de procedimientos clínicos
Pertinencia curricular Muy alta
Alineación institucional Coherente con objetivos académicos y de calidad
Relación con la capacitación genérica institucional Se articula con la capacitación institucional.

6. Resumen Ejecutivo de Resultados del Diagnóstico
Tabla 55 Consolidado ejecutivo de capacitaciones específicas por carrera
Carrera Capacitación priorizada
Gestión del Talento Humano Estrategia Analítica y Gestión del Talento Humano
Enfermería Manejo Clínico del Recién Nacido
Tabla 56 Caracterización de las capacitaciones específicas
Tipo de capacitación Porcentaje aproximado
Disciplinar / técnica 65 %
Pedagógica especializada 21 %
Tecnológica aplicada 14 %
Síntesis ejecutiva:
Las prioridades responden a necesidades disciplinares y pedagógicas.
6.3. Priorización final de necesidades de capacitación
Tabla 57 Priorización final institucional
Nivel Tipo de capacitación Características
Nivel 1 Capacitación genérica institucional Transversal, estructural, base pedagógica común
Nivel 2 Capacitaciones específicas por carrera Disciplinar, contextualizada, complementaria

7. Conclusiones del Diagnóstico:
El diagnóstico evidencia una necesidad genérica institucional y prioridades específicas por carrera.

8. Recomendaciones para la Elaboración del Plan de Capacitación Docente:
Incorporar las prioridades identificadas, definir cronograma, responsables e indicadores de seguimiento.

9. Bibliografía
Referencias institucionales.
Página 2 de 110 Página 3 de 110 Página 4 de 110 Página 5 de 110 Página 110 de 110
`
  };
}

function runNeedsDetectionParserTest() {
  const processor = assertProcessor("deteccion-necesidades");
  const parseResult = processor.parseDocuments([createSyntheticNeedsDetection()]);
  assertCondition(parseResult.parsedCount === 1, "No se procesó el diagnóstico sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const general = document.datos_generales;
  assertCondition(document.archivo.codigo_documento === "UGPA-RGI1-01-PRO-70-2025-10", "No se extrajo el código PRO-70.");
  assertCondition(document.archivo.periodo === "2025-10", "No se extrajo el periodo.");
  assertCondition(document.archivo.documento_unico_periodo === "SI", "No se marcó como documento único.");
  assertCondition(document.archivo.inconsistencia_paginas === "NO", "Se detectó una inconsistencia inexistente.");
  assertCondition(general.periodo_documental_texto === "Octubre 2025 – Marzo 2026", "No se extrajo el alcance temporal.");
  assertCondition(general.total_respuestas_validas === 125, "No se extrajo el total de respuestas.");
  assertCondition(general.capacitacion_generica_priorizada === "Desarrollador de Contenidos de Aprendizaje", "No se extrajo la capacitación genérica.");
  assertCondition(document.fuentes.length >= 5, "No se detectaron las fuentes principales.");
  assertCondition(document.necesidades_institucionales.length === 5, "No se extrajeron cinco necesidades institucionales.");
  assertCondition(document.necesidades_carrera.length === 10, "No se extrajeron diez necesidades por carrera.");
  assertCondition(document.prioridades_carrera.length === 2, "No se extrajeron dos prioridades por carrera.");
  assertCondition(document.prioridades_carrera.some((row) => row.carrera === "Enfermería" && row.porcentaje_recurrencia === 79), "No se vinculó la recurrencia de Enfermería.");
  assertCondition(document.consolidado.some((row) => row.tipo_registro === "CAPACITACION_GENERICA_PRIORIZADA"), "No se consolidó la prioridad genérica.");
  assertCondition(document.consolidado.filter((row) => row.tipo_registro === "CARACTERIZACION_ESPECIFICA").length === 3, "No se extrajo la caracterización porcentual.");
  assertCondition(document.analisis.conclusiones.includes("necesidad genérica"), "No se extrajeron conclusiones.");
  assertCondition(document.analisis.recomendaciones_plan_capacitacion.includes("cronograma"), "No se extrajeron recomendaciones.");
  assertCondition(document.responsables.length === 3, "No se extrajeron tres responsables.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El diagnóstico sintético produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const tableValidation = processor.validateTableResult(tableResult);
  assertCondition(tableValidation.ok, "La estructura de nueve tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 9, "No se construyeron nueve tablas.");
  assertCondition(tableResult.summary.rows_by_table.necesidades_por_carrera === 10, "La tabla de necesidades por carrera es incorrecta.");
  assertCondition(tableResult.summary.rows_by_table.prioridades_por_carrera === 2, "La tabla de prioridades es incorrecta.");

  const multipleResult = processor.parseDocuments([createSyntheticNeedsDetection(), createSyntheticNeedsDetection()]);
  assertCondition(multipleResult.parsedCount === 0 && multipleResult.errorCount === 1, "No se aplicó la regla de documento único.");

  return {
    ok: true,
    documentId: document.id_documento,
    periodo: general.periodo_documental_texto,
    fuentes: document.fuentes.length,
    necesidadesInstitucionales: document.necesidades_institucionales.length,
    necesidadesCarrera: document.necesidades_carrera.length,
    prioridadesCarrera: document.prioridades_carrera.length,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    console.log("DETECCION_NECESIDADES_PARSER_OK");
    console.log(JSON.stringify(runNeedsDetectionParserTest(), null, 2));
  } catch (error) {
    console.error("DETECCION_NECESIDADES_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { createSyntheticNeedsDetection, runNeedsDetectionParserTest };
