/* =========================================================
Nombre completo: informe-final.parser.test.js
Ruta o ubicación: /src/diagnostics/informe-final.parser.test.js
Función o funciones:
- Probar el parser de Informes Finales de Capacitación.
- Verificar curso, facilitador, fechas, duración, participantes y certificados.
- Confirmar resumen, responsables y construcción de seis tablas.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createSyntheticFinalReport() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-INF-01-PRO-134-2025-09-Educacion-financiera.pdf",
    fileName: "UGPA-INF-01-PRO-134-2025-09-Educacion-financiera.pdf",
    fileHash: "hash-sintetico-informe-final",
    pageCount: 7,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
Informe Final De La Capacitación: Educación Financiera Dirigido A La Carrera de Administración
UNIDAD DE GESTIÓN DE PROCESOS ACADÉMICOS
Código: UGPA-INF-01-PRO￾134-2025-09
Versión: 1.0
Fecha de Elaboración: 26-09-2025
Informe Final de la Capacitación: Educación Financiera Dirigido A La Carrera de Administración Página 1 de 7
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: Msg. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: COORDINADOR DE CARRERAS CARGO: COORDINADORA GENERAL DE CARRERAS CARGO: VICERRECTOR

1. NOMBRE DEL/LOS FACILITADOR/ES
ITSQMET
2. FECHAS DE IMPARTICIÓN
FECHA INICIO: 28 de agosto de 2025
FECHA FINAL: 26 de septiembre de 2025
3. DURACIÓN: 40 horas
4. OBJETIVO GENERAL:
Desarrollar competencias en educación financiera mediante estrategias de gamificación educativa.
5. CUMPLIMIENTO DE LOS OBJETIVOS DEL CURSO:
El curso cumplió satisfactoriamente con los objetivos establecidos y los participantes demostraron aplicación efectiva.
6. MATRIZ CON LOS DATOS DE LOS PARTICIPANTES:
Nº Nombres y Apellidos Cédula de Identidad Tiene Discapacidad Tipo de Discapacidad Posee Carné de Discapacidad Género
1 Jorge Roberto Uquillas Erazo 1715182562 No Ninguna No Masculino
2 José Sebastián Zambrano Urgilez 0302155221 No Ninguna No Masculino
3 Luis Antonio Segovia Valdiviezo 1718269531 No Ninguna No Masculino
7. CERTIFICADOS A ENTREGAR:
Nº Nombres y Apellidos Certificado de Aprobación Certificado de Participación Certificado de Facilitador Reprobó el Curso Desertó el Curso
1 Jorge Roberto Uquillas Erazo X
2 José Sebastián Zambrano Urgilez X
3 Luis Antonio Segovia Valdiviezo X
8. RESÚMEN ENTREGA DE CERTIFICADOS:
TOTAL INSCRITOS: TOTAL DE PERSONAS QUE OBTUVIERON CERTIFICADO DE APROBACIÓN: TOTAL DE PERSONAS QUE OBTUVIERON CERTIFICADO DE PARTICIPACIÓN: TOTAL DOCENTE/S FACILITADOR/ES: TOTAL DE PERSONAS QUE DESERTARON EL CURSO: TOTAL DE PERSONAS QUE REPROBARON EL CURSO:
3 3 0 0 0 0
9. ANEXO
Página 2 de 7 Página 3 de 7 Página 4 de 7 Página 5 de 7 Página 6 de 7 Página 7 de 7
`
  };
}

function runFinalReportParserTest() {
  const processor = assertProcessor("informe-final");
  const parseResult = processor.parseDocuments([createSyntheticFinalReport()]);

  assertCondition(parseResult.parsedCount === 1, "El parser no procesó el informe sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const general = document.datos_generales;

  assertCondition(document.archivo.codigo_documento === "UGPA-INF-01-PRO-134-2025-09", "No se extrajo el código del informe.");
  assertCondition(document.archivo.periodo === "2025-09", "No se extrajo el periodo.");
  assertCondition(document.archivo.inconsistencia_paginas === "NO", "Se detectó una inconsistencia de páginas inexistente.");
  assertCondition(general.nombre_capacitacion === "Educación Financiera", "No se extrajo la capacitación.");
  assertCondition(general.carrera_publico === "Administración", "No se extrajo la carrera.");
  assertCondition(general.facilitador === "ITSQMET", "No se extrajo el facilitador.");
  assertCondition(general.fecha_inicio === "2025-08-28", "No se normalizó la fecha de inicio.");
  assertCondition(general.fecha_fin === "2025-09-26", "No se normalizó la fecha final.");
  assertCondition(general.duracion_horas === 40, "No se extrajo la duración.");
  assertCondition(document.participantes.length === 3, "No se extrajeron tres participantes.");
  assertCondition(document.resultados.length === 3, "No se generaron tres resultados.");
  assertCondition(document.resultados.every((row) => row.certificado_aprobacion === "SI"), "No se asignó el certificado de aprobación.");
  assertCondition(document.resumen.total_inscritos === 3, "No se extrajo el total de inscritos.");
  assertCondition(document.resumen.total_certificado_aprobacion === 3, "No se extrajo el total de aprobados.");
  assertCondition(document.responsables.length === 3, "No se extrajeron tres responsables.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El informe sintético produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const structureValidation = processor.validateTableResult(tableResult);

  assertCondition(structureValidation.ok, "La estructura de seis tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 6, "No se construyeron seis tablas.");
  assertCondition(tableResult.summary.rows_by_table.participantes_informe_final === 3, "La tabla de participantes no contiene tres filas.");
  assertCondition(tableResult.summary.rows_by_table.resultados_informe_final === 3, "La tabla de resultados no contiene tres filas.");
  assertCondition(tableResult.summary.rows_by_table.responsables_informe_final === 3, "La tabla de responsables no contiene tres filas.");

  return {
    ok: true,
    documentId: document.id_documento,
    codigoDocumento: document.archivo.codigo_documento,
    capacitacion: general.nombre_capacitacion,
    participantes: document.participantes.length,
    aprobados: document.resumen.total_certificado_aprobacion,
    responsables: document.responsables.length,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    const result = runFinalReportParserTest();
    console.log("INFORME_FINAL_PARSER_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("INFORME_FINAL_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  createSyntheticFinalReport,
  runFinalReportParserTest
};
