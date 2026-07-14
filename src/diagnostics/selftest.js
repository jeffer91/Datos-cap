/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /src/diagnostics/selftest.js
Función o funciones:
- Probar Planes, Acuerdos, Planificaciones, base y consultas.
- Verificar exportación Excel/JSON sin ejecutar OCR real.
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
const { createPersistenceService, createQueryService } = require("../database");
const { detectDocumentType } = require("../validators/document-selection.validator");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createPlanDocument() {
  const id = ids.createDocumentId("mock-plan.pdf", 0, "UGPA-RGI1-01-PRO-251-2026-03", "hash-plan", "plan-individual");
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
      nombre_formacion: "Doctorado en Educación",
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
En la ciudad de Quito, a los 01 días del mes de Marzo de 2026, el/la señor(a) Andrea Gabriela Bustamante Banchon, con número de cédula 1314227487, quien en lo sucesivo se denominará El Colaborador.
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
2. DESCRIPCIÓN DEL CURSO: Curso orientado a la aplicación de Scrum, Kanban y Lean en contextos administrativos.
3. FORMA DE EJECUCIÓN
X CURSO
SEMINARIO
TALLER
4. TIPO DE CAPACITACIÓN
X CAPACITACIÓN CONCRETA ESPECÍFICA
CAPACITACIÓN INTELECTUAL GENÉRICA
5. CARÁCTER
X NACIONAL
INTERNACIONAL
6. MODALIDAD
PRESENCIAL
X VIRTUAL
HÍBRIDA
7. TIPO DE CERTIFICADO
X APROBACIÓN
PARTICIPACIÓN
8. DIRIGIDO A: Docentes y estudiantes de la carrera de Administración
9. ARTICULACIÓN DEL CURSO: Fortalece la gestión de proyectos.
10. OBJETIVO GENERAL DEL CURSO: Aplicar metodologías ágiles en proyectos administrativos.
11. TÓPICOS O TEMAS CUBIERTOS
UNIDAD 1: Fundamentos de metodologías ágiles
Scrum, Kanban y Lean
2 5 3
Aplica conceptos ágiles en proyectos reales.
UNIDAD 2: Gestión visual y mejora continua
Tableros, retrospectivas y métricas
2 5 3
Construye un tablero de seguimiento.
12. AMBIENTE DE APRENDIZAJE: Plataforma virtual institucional.
13. EVALUACIÓN DEL CURSO
Trabajo Grupal Proyecto integrador 1
Evaluación final Caso práctico 1
14. FACILITADOR DE LA CAPACITACIÓN
NOMBRE: Facilitador Demo
CARGO: Consultor
PERFIL: Especialista en gestión ágil
15. ANEXOS
Correo de invitación y evidencia de plataforma.`;
  const pages = [
    { pageNumber: 1, text: text.slice(0, 900), confidence: 90 },
    { pageNumber: 2, text: text.slice(900), confidence: 86 }
  ];
  return planning.parser.parseDocument({
    text,
    pages,
    fileName: "mock-planificacion.pdf",
    filePath: "mock-planificacion.pdf",
    fileHash: "hash-planning",
    index: 0,
    pageCount: 2,
    digitalPageCount: 0,
    ocrPageCount: 2,
    ocrConfidence: 88,
    extractionMethod: "ocr",
    ok: true
  });
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-selftest-"));
  const planDocument = createPlanDocument();
  const agreementDocument = createAgreementDocument();
  const planningDocument = createPlanningDocument();
  const planResult = planTables.buildAllTables([planDocument]);
  const agreementResult = agreement.tables.buildTables([agreementDocument]);
  const planningResult = planning.tables.buildTables([planningDocument]);

  assertCondition(planResult.summary.total_tables === 5, "No se construyeron las 5 tablas de Planes.");
  assertCondition(agreementResult.summary.total_tables === 4, "No se construyeron las 4 tablas de Acuerdos.");
  assertCondition(planningResult.summary.total_tables === 8, "No se construyeron las 8 tablas de Planificaciones.");
  assertCondition(agreementDocument.datos_acuerdo.cedula_docente === "1314227487", "No se extrajo la cédula del acuerdo.");
  assertCondition(agreementDocument.apoyos.some((row) => row.seleccionado === "SI"), "No se detectó el apoyo marcado.");
  assertCondition(planningDocument.datos_generales.nombre_curso.includes("Metodologías Ágiles"), "No se extrajo el curso de la planificación.");
  assertCondition(planningDocument.unidades.length === 2, "No se detectaron las dos unidades de la planificación.");
  assertCondition(detectDocumentType(textForPlanning(planningDocument), "") === "planificacion-capacitacion", "No se identifica el tercer tipo documental.");

  const exports = {
    plan: exporters.exportAll({ outputDir: tempDir, baseName: "selftest_plan", tables: planResult.tables, summary: planResult.summary, validations: planResult.validations }),
    agreement: exporters.exportAll({ outputDir: tempDir, baseName: "selftest_acuerdo", tables: agreementResult.tables, summary: agreementResult.summary, validations: agreementResult.validations }),
    planning: exporters.exportAll({ outputDir: tempDir, baseName: "selftest_planificacion", tables: planningResult.tables, summary: planningResult.summary, validations: planningResult.validations })
  };
  assertCondition(fs.existsSync(exports.plan.files.excel.filePath), "No se creó el Excel de Planes.");
  assertCondition(fs.existsSync(exports.agreement.files.json.filePath), "No se creó el JSON de Acuerdos.");
  assertCondition(fs.existsSync(exports.planning.files.excel.filePath), "No se creó el Excel de Planificaciones.");

  const persistence = createPersistenceService(path.join(tempDir, "database"));
  const saveAll = [
    ["plan-individual", planDocument, planResult],
    ["acuerdo-patrocinio", agreementDocument, agreementResult],
    ["planificacion-capacitacion", planningDocument, planningResult]
  ];
  saveAll.forEach(([documentType, document, result]) => {
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
  assertCondition(summary.planCount === 1, "El Plan no se guardó en la base local.");
  assertCondition(summary.agreementCount === 1, "El Acuerdo no se guardó en la base local.");
  assertCondition(summary.planningCount === 1, "La Planificación no se guardó en la base local.");
  assertCondition(query.listTypeRecords("planificacion-capacitacion").records.length === 1, "La consulta de Planificaciones no devuelve registros.");

  return {
    ok: true,
    tempDir,
    tables: {
      plans: planResult.summary.total_tables,
      agreements: agreementResult.summary.total_tables,
      planning: planningResult.summary.total_tables
    },
    database: summary,
    files: exports
  };
}

function textForPlanning(document) {
  return `PLANIFICACIÓN DE CAPACITACIÓN ${document.archivo.codigo_documento} ${document.datos_generales.nombre_curso}`;
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
  runSelfTest
};
