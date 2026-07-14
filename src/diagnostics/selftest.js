/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /src/diagnostics/selftest.js
Función o funciones:
- Probar Planes, Acuerdos, Planificaciones e Informes Finales.
- Verificar exportación, persistencia, consultas y detalles sin ejecutar OCR real.
========================================================= */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const ids = require("../utils/ids");
const planTables = require("../tables");
const exporters = require("../exporters");
const agreement = require("../document-types/acuerdo-patrocinio");
const planning = require("../document-types/planificacion-capacitacion");
const finalReports = require("../document-types/informe-final-capacitacion");
const { createPersistenceService, createQueryService } = require("../database");
const { detectDocumentType } = require("../validators/document-selection.validator");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createPlanDocument() {
  const id = ids.createDocumentId("mock-plan.pdf", 0, "UGPA-RGI1-01-PRO-251-2026-03");
  return {
    id_documento: id,
    archivo: {
      id: ids.createRowId("archivo", id, 0, "mock-plan.pdf"),
      id_documento: id,
      nombre_archivo: "mock-plan.pdf",
      ruta_archivo: "mock-plan.pdf",
      hash_archivo: "hash-plan",
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      numero_registro: "01",
      periodo: "2026-03",
      total_paginas: 6,
      metodo_extraccion: "digital",
      paginas_digitales: 6,
      paginas_ocr: 0,
      confianza_ocr: 0,
      estado_extraccion: "OK",
      requiere_revision: "NO",
      observacion_extraccion: ""
    },
    identificacion: {
      id: ids.createRowId("identificacion", id, 0, "Docente Demo"),
      id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      periodo: "2026-03",
      nombre_docente: "Docente Demo",
      tiempo_dedicacion: "Tiempo Completo",
      carrera: "Administración",
      funcion_sustantiva: "Docencia",
      nombre_firma_docente: "Docente Demo",
      nombre_aprobador: "Jefferson Villarreal",
      cargo_aprobador: "Gestor de Procesos Académicos",
      requiere_revision: "NO",
      observacion_extraccion: ""
    },
    capacidades: {
      id: ids.createRowId("capacidades", id, 0, "Docente Demo"),
      id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      nombre_docente: "Docente Demo",
      carrera: "Administración",
      curso_actualizacion_ultimos_12_meses: "Curso Demo",
      avances_disciplinares_aplicados: "IA",
      comodidad_metodologias_nuevas: "Alta",
      estrategias_pedagogicas: "ABP",
      herramientas_tecnologicas: "Moodle",
      formacion_adicional_necesaria: "Analítica",
      nivel_academico_actual: "Maestría",
      tipo_formacion_propuesta: "Específica",
      requiere_revision: "NO",
      observacion_extraccion: ""
    },
    capacitaciones: [{
      id: ids.createRowId("capacitacion", id, 0, "Curso Demo"),
      id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      nombre_docente: "Docente Demo",
      carrera: "Administración",
      nombre_capacitacion: "Curso Demo",
      horas_capacitacion: "40",
      fecha_inicio_capacitacion: "01/03/2026",
      fecha_fin_capacitacion: "31/03/2026",
      fecha_texto_original: "01/03/2026 al 31/03/2026",
      tipo_capacitacion: "Aprobación",
      requiere_revision: "NO",
      observacion_extraccion: ""
    }],
    formacion: [{
      id: ids.createRowId("formacion", id, 0, "Maestría"),
      id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      nombre_docente: "Docente Demo",
      carrera: "Administración",
      situacion_actual_formacion: "Maestría",
      situacion_propuesta_formacion: "Doctorado",
      tiempo_esperado_cumplimiento: "24 meses",
      nombre_formacion: "Doctorado en Educación",
      nivel_academico_formacion: "Doctorado",
      tipo_formacion: "Específica",
      requiere_revision: "NO",
      observacion_extraccion: ""
    }],
    source: { file_hash: "hash-plan", extraction_method: "digital", digital_pages: 6, ocr_pages: 0 }
  };
}

function createAgreementDocument() {
  const text = `ACUERDO DE PATROCINIO INSTITUCIONAL
DOCENTE: Andrea Gabriela Bustamante Banchon
CARRERA: Contabilidad
CAPACITACIÓN: Auditoría Forense e Inteligencia Financiera
Código: UGPA-RGI2-13-PRO-134-2026-03
ELABORADO POR: APROBADO POR:
NOMBRE: Andrea Gabriela Bustamante Banchon NOMBRE: Msc. Jefferson Villarreal
CARGO: Docente CARGO: Coordinador de Carreras
En la ciudad de Quito, a los 01 días del mes de Marzo de 2026, el/la señor(a) Andrea Gabriela Bustamante Banchon, con número de cédula 1314227487.
El Colaborador actualmente se encuentra vinculado(a) como Docente en el ITSQMET.
El patrocinio institucional comprende los siguientes:
Financiamiento total del costo del curso X
Financiamiento parcial del costo del curso
Anticipo de sueldos/honorarios
Cambio temporal en modalidad de trabajo
Licencia con remuneración
Licencia sin remuneración
Ajuste de horario laboral
COMPROMISOS DEL COLABORADOR`;
  return agreement.parser.parseDocument({
    text,
    fileName: "mock-acuerdo.pdf",
    filePath: "mock-acuerdo.pdf",
    fileHash: "hash-agreement",
    index: 0,
    pageCount: 3,
    extractionMethod: "ocr",
    ocrPageCount: 3,
    ocrConfidence: 88,
    ok: true
  });
}

function createPlanningDocument() {
  const text = `PLANIFICACIÓN DE CAPACITACIÓN: Metodologías Ágiles para la Gestión Moderna, DIRIGIDO A LA CARRERA DE ADMINISTRACIÓN
Código: UGPA-RGI1-05-PRO-134-2026-03
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: Msc. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: Gestor de Procesos Académicos CARGO: Coordinadora General de Carreras CARGO: Vicerrector
1. NOMBRE DEL CURSO: Metodologías Ágiles para la Gestión Moderna
2. DESCRIPCIÓN DEL CURSO: Curso orientado a Scrum, Kanban y Lean.
3. FORMA DE EJECUCIÓN
X CURSO
4. TIPO DE CAPACITACIÓN
X CAPACITACIÓN CONCRETA ESPECÍFICA
5. CARÁCTER
X NACIONAL
6. MODALIDAD
X VIRTUAL
7. TIPO DE CERTIFICADO
X APROBACIÓN
8. DIRIGIDO A: Docentes de Administración
9. ARTICULACIÓN DEL CURSO: Fortalece la gestión.
10. OBJETIVO GENERAL DEL CURSO: Aplicar metodologías ágiles.
11. TÓPICOS O TEMAS CUBIERTOS
UNIDAD 1: Fundamentos de metodologías ágiles
Scrum, Kanban y Lean
2 5 3
Aplica conceptos ágiles.
12. AMBIENTE DE APRENDIZAJE: Plataforma virtual.
13. EVALUACIÓN DEL CURSO
Trabajo Grupal Proyecto integrador 1
14. FACILITADOR DE LA CAPACITACIÓN
NOMBRE: Facilitador Demo
CARGO: Consultor
PERFIL: Especialista en gestión ágil
15. ANEXOS
Correo de invitación.`;
  return planning.parser.parseDocument({
    text,
    pages: [{ pageNumber: 1, text, confidence: 88, textLength: text.length }],
    fileName: "mock-planificacion.pdf",
    filePath: "mock-planificacion.pdf",
    fileHash: "hash-planning",
    index: 0,
    pageCount: 1,
    digitalPageCount: 0,
    ocrPageCount: 1,
    ocrConfidence: 88,
    extractionMethod: "ocr",
    ok: true
  });
}

function createFinalReportDocument() {
  const text = `Informe Final De La Capacitación: Inteligencia Artificial Generativa Aplicada a la Educación
Código: UGPA-INF-01-PRO-134-2024-12
Fecha de Elaboración: 22-diciembre-2024
Página 1 de 2
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: Mgs. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: Coordinador de Carreras CARGO: Coordinadora General de Carreras CARGO: Vicerrector
1. NOMBRE DEL/LOS FACILITADOR/ES
Universidad UNIR
2. FECHAS DE IMPARTICIÓN
FECHA INICIO: 14 de octubre de 2024
FECHA FINAL: 22 de diciembre de 2024
3. DURACIÓN: 150 horas
4. OBJETIVO GENERAL:
Objetivo General
Formar a los educadores en el uso ético de la inteligencia artificial.
Objetivos Específicos
Aplicar herramientas de inteligencia artificial en educación.
5. CUMPLIMIENTO DE LOS OBJETIVOS DEL CURSO:
El curso cumplió satisfactoriamente los objetivos establecidos.
6. MATRIZ CON LOS DATOS DE LOS PARTICIPANTES:
1 Aldas Gomez Karina Mishelle 0250064474 No Ninguna No Femenino
2 Bermeo Ochoa Danny Patricio 1720775913 No Ninguna No Masculino
7. CERTIFICADOS A ENTREGAR:
1 Aldas Gomez Karina Mishelle X
2 Bermeo Ochoa Danny Patricio X
8. RESUMEN ENTREGA DE CERTIFICADOS:
TOTAL INSCRITOS: 2
TOTAL DE PERSONAS QUE OBTUVIERON CERTIFICADO DE APROBACIÓN: 2
TOTAL DE PERSONAS QUE OBTUVIERON CERTIFICADO DE PARTICIPACIÓN: 0
TOTAL DOCENTE/S FACILITADOR/ES: 0
TOTAL DE PERSONAS QUE DESERTARON EL CURSO: 0
TOTAL DE PERSONAS QUE REPROBARON EL CURSO: 0`;
  return finalReports.parser.parseDocument({
    text,
    pages: [{ pageNumber: 1, text, confidence: 92, textLength: text.length }],
    fileName: "mock-informe-final.pdf",
    filePath: "mock-informe-final.pdf",
    fileHash: "hash-final-report",
    index: 0,
    pageCount: 3,
    digitalPageCount: 0,
    ocrPageCount: 1,
    ocrConfidence: 92,
    extractionMethod: "mixed",
    ok: true
  });
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-selftest-"));
  const documents = {
    plan: createPlanDocument(),
    agreement: createAgreementDocument(),
    planning: createPlanningDocument(),
    finalReport: createFinalReportDocument()
  };
  const results = {
    plan: planTables.buildAllTables([documents.plan]),
    agreement: agreement.tables.buildTables([documents.agreement]),
    planning: planning.tables.buildTables([documents.planning]),
    finalReport: finalReports.tables.buildTables([documents.finalReport])
  };

  assertCondition(results.plan.summary.total_tables === 5, "No se construyeron las 5 tablas de Planes.");
  assertCondition(results.agreement.summary.total_tables === 4, "No se construyeron las 4 tablas de Acuerdos.");
  assertCondition(results.planning.summary.total_tables === 8, "No se construyeron las 8 tablas de Planificaciones.");
  assertCondition(results.finalReport.summary.total_tables === 9, "No se construyeron las 9 tablas de Informes Finales.");
  assertCondition(documents.finalReport.participantes.length === 2, "No se detectaron los participantes del Informe Final.");
  assertCondition(documents.finalReport.archivo.coinciden_paginas === "NO", "No se detectó la diferencia de paginación.");
  assertCondition(detectDocumentType("INFORME FINAL DE LA CAPACITACIÓN UGPA-INF-01-PRO-134-2024-12", "") === "informe-final-capacitacion", "No se identifica el cuarto tipo documental.");

  const exports = {};
  Object.entries(results).forEach(([key, result]) => {
    exports[key] = exporters.exportAll({
      outputDir: tempDir,
      baseName: `selftest_${key}`,
      tables: result.tables,
      summary: result.summary,
      validations: result.validations,
      warnings: [],
      errors: []
    });
    assertCondition(fs.existsSync(exports[key].files.excel.filePath), `No se creó el Excel de ${key}.`);
    assertCondition(fs.existsSync(exports[key].files.json.filePath), `No se creó el JSON de ${key}.`);
  });

  const persistence = createPersistenceService(path.join(tempDir, "database"));
  const entries = [
    ["plan-individual", documents.plan, results.plan],
    ["acuerdo-patrocinio", documents.agreement, results.agreement],
    ["planificacion-capacitacion", documents.planning, results.planning],
    ["informe-final-capacitacion", documents.finalReport, results.finalReport]
  ];
  entries.forEach(([documentType, document, result]) => {
    const saved = persistence.persistProcessingResult({
      documentType,
      parsedDocuments: [document],
      tables: result.tables,
      summary: result.summary,
      outputDir: tempDir
    });
    persistence.completeRun(saved.runId, { ok: true, files: {} });
  });

  const query = createQueryService(persistence.database);
  const summary = query.getSummary();
  assertCondition(summary.planCount === 1, "El Plan no se guardó.");
  assertCondition(summary.agreementCount === 1, "El Acuerdo no se guardó.");
  assertCondition(summary.planningCount === 1, "La Planificación no se guardó.");
  assertCondition(summary.finalReportCount === 1, "El Informe Final no se guardó.");
  assertCondition(query.listTypeRecords("informe-final-capacitacion").records.length === 1, "La consulta de Informes Finales no devuelve registros.");
  const details = query.getDocumentDetails(documents.finalReport.id_documento);
  assertCondition(details.collections.participantes_informe.length === 2, "La vista Detalles no recupera participantes.");

  return {
    ok: true,
    tempDir,
    tables: {
      plans: results.plan.summary.total_tables,
      agreements: results.agreement.summary.total_tables,
      planning: results.planning.summary.total_tables,
      finalReports: results.finalReport.summary.total_tables
    },
    database: summary,
    files: exports
  };
}

if (require.main === module) {
  try {
    const result = runSelfTest();
    console.log("SELFTEST_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  createPlanDocument,
  createAgreementDocument,
  createPlanningDocument,
  createFinalReportDocument,
  runSelfTest
};
