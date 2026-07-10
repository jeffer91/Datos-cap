/* =========================================================
Nombre completo: informe-impacto.parser.test.js
Ruta o ubicación: /src/diagnostics/informe-impacto.parser.test.js
Función o funciones:
- Probar el parser del Informe de Impacto de la Capacitación.
- Verificar datos, indicadores, objetivos, metodología, análisis y responsables.
- Confirmar la construcción de las siete tablas del módulo.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createSyntheticImpactReport() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-INF-01-PRO-135-2025-11-Educacion-financiera.pdf",
    fileName: "UGPA-INF-01-PRO-135-2025-11-Educacion-financiera.pdf",
    fileHash: "hash-sintetico-informe-impacto",
    pageCount: 7,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
Informe De Impacto De La Capacitación: Educación Financiera Dirigido A La Carrera de Administración
UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS
Código: UGPA-INF-01-PRO￾135-2025-11
Versión: 1.0
Fecha de Elaboración: 3-noviembre-2025
Página 1 de 7
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: Msg. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: COORDINADOR DE CARRERAS CARGO: COORDINADORA GENERAL DE CARRERAS CARGO: VICERRECTOR

1. Datos Generales del Informe
Nombre del Curso: Educación Financiera
Período de la Capacitación: agosto 2025 – septiembre 2025
FECHA INICIO: 28/08/2025
FECHA FINAL: 26/09/2025
Facilitador(es): ITSQMET
Número de Participantes: 3
Fecha de Elaboración del Informe: 03-11-2025

2. Resumen Ejecutivo
Objetivo del Informe:
Evaluar el impacto de la capacitación de Educación Financiera en la aplicación profesional y en el cumplimiento de los objetivos institucionales.
Resumen de Hallazgos Clave:
Impacto Cualitativo:
Relevancia del contenido: El 95% consideró altamente relevante el contenido.
Aplicación práctica: El 100% aplicó los conocimientos adquiridos.
Confianza profesional: El 85% indicó una mayor confianza.
Interacción con el facilitador: El 92% valoró positivamente la interacción.
Satisfacción general: El 90% destacó la utilidad de las herramientas.
Impacto Cuantitativo:
Participación: Se alcanzó una participación del 100% con tres inscritos.
Cumplimiento del cronograma: Se ejecutó el 100% de las actividades.
Aplicabilidad del conocimiento: El 100% aplicó lo aprendido.
Recomendaciones Principales:
Mantener talleres prácticos, seguimiento posterior y herramientas digitales aplicadas.

3. Introducción
Contexto institucional y justificación de la medición de impacto.

4. Metodología
Métodos de Medición:
Comparación previa y posterior, observación directa y análisis de evidencias.
Instrumentos de Medición:
Escalas de Satisfacción, Observación Directa, Pruebas de Conocimiento y Entrevistas.

5. Resultados Cualitativos
Los participantes incorporaron los conocimientos en sus actividades laborales y académicas.

6. Resultados Cuantitativos
Se observó aplicación del 100%, satisfacción del 90% y participación del 100%.

7. Análisis y Discusión
Evaluación del Cumplimiento de Objetivos:
Objetivo 1: Mejora en la aplicación del conocimiento. El 100% aplicó los conocimientos adquiridos en situaciones profesionales.
Objetivo 2: Incremento en la eficiencia y reducción de errores. Los datos reflejan una mejora del 20% en eficiencia y una reducción de errores.
Análisis de Causalidad:
Las comparaciones previas y posteriores permiten atribuir los resultados a la capacitación.
Identificación de Variables Moderadoras:
La motivación personal y el entorno institucional pudieron influir en los resultados.

8. Conclusiones:
La capacitación produjo resultados positivos, aplicación práctica y alta satisfacción.

9. Recomendaciones:
Fortalecer el seguimiento post-capacitación y ampliar las actividades prácticas.

10. Anexos
Página 2 de 7 Página 3 de 7 Página 4 de 7 Página 5 de 7 Página 6 de 7 Página 7 de 7
`
  };
}

function runImpactReportParserTest() {
  const processor = assertProcessor("informe-impacto");
  const parseResult = processor.parseDocuments([createSyntheticImpactReport()]);
  assertCondition(parseResult.parsedCount === 1, "No se procesó el informe sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const general = document.datos_generales;
  assertCondition(document.archivo.codigo_documento === "UGPA-INF-01-PRO-135-2025-11", "No se extrajo el código PRO-135.");
  assertCondition(document.archivo.periodo === "2025-11", "No se extrajo el periodo.");
  assertCondition(document.archivo.inconsistencia_paginas === "NO", "Se detectó una inconsistencia de páginas inexistente.");
  assertCondition(general.nombre_curso === "Educación Financiera", "No se extrajo el curso.");
  assertCondition(general.carrera_publico === "Administración", "No se extrajo la carrera.");
  assertCondition(general.facilitador === "ITSQMET", "No se extrajo el facilitador.");
  assertCondition(general.numero_participantes === 3, "No se extrajo el número de participantes.");
  assertCondition(general.fecha_inicio === "2025-08-28", "No se normalizó la fecha de inicio.");
  assertCondition(general.fecha_fin === "2025-09-26", "No se normalizó la fecha final.");
  assertCondition(document.indicadores.length === 8, "No se extrajeron ocho indicadores.");
  assertCondition(document.indicadores.filter((row) => row.tipo_impacto === "CUALITATIVO").length === 5, "No se extrajeron cinco indicadores cualitativos.");
  assertCondition(document.indicadores.filter((row) => row.tipo_impacto === "CUANTITATIVO").length === 3, "No se extrajeron tres indicadores cuantitativos.");
  assertCondition(document.objetivos.length === 2, "No se extrajeron dos objetivos.");
  assertCondition(document.metodologia.incluye_escalas_satisfaccion === "SI", "No se reconocieron escalas de satisfacción.");
  assertCondition(document.metodologia.incluye_observacion === "SI", "No se reconoció observación.");
  assertCondition(document.metodologia.incluye_pruebas_conocimiento === "SI", "No se reconocieron pruebas de conocimiento.");
  assertCondition(document.analisis.conclusiones.includes("resultados positivos"), "No se extrajeron conclusiones.");
  assertCondition(document.analisis.recomendaciones_finales.includes("seguimiento"), "No se extrajeron recomendaciones.");
  assertCondition(document.responsables.length === 3, "No se extrajeron tres responsables.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El informe sintético produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const structureValidation = processor.validateTableResult(tableResult);
  assertCondition(structureValidation.ok, "La estructura de siete tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 7, "No se construyeron siete tablas.");
  assertCondition(tableResult.summary.rows_by_table.indicadores_informe_impacto === 8, "La tabla de indicadores no contiene ocho filas.");
  assertCondition(tableResult.summary.rows_by_table.objetivos_informe_impacto === 2, "La tabla de objetivos no contiene dos filas.");

  return {
    ok: true,
    documentId: document.id_documento,
    curso: general.nombre_curso,
    participantes: general.numero_participantes,
    indicadores: document.indicadores.length,
    objetivos: document.objetivos.length,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    console.log("INFORME_IMPACTO_PARSER_OK");
    console.log(JSON.stringify(runImpactReportParserTest(), null, 2));
  } catch (error) {
    console.error("INFORME_IMPACTO_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { createSyntheticImpactReport, runImpactReportParserTest };
