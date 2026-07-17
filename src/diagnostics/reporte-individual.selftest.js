/* =========================================================
Nombre completo: reporte-individual.selftest.js
Ruta: /src/diagnostics/reporte-individual.selftest.js
Función: Probar cruces por docente, cédula y nombres variables de capacitación.
========================================================= */
"use strict";

const { createIndividualReportService } = require("../reporte-individual");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createFakeDatabase() {
  const collections = {
    _documents: [],
    identificacion_docente: [{
      id: "teacher-1", id_documento: "plan-1", codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      nombre_docente: "María Fernanda Pérez", carrera: "Administración", tiempo_dedicacion: "Tiempo Completo"
    }],
    capacitaciones_propuestas: [{
      id: "training-1", id_documento: "plan-1", nombre_docente: "María Fernanda Pérez",
      nombre_capacitacion: "Planificación DUA"
    }],
    datos_acuerdo_patrocinio: [{
      id: "agreement-1", id_documento: "agreement-document-1", nombre_docente: "Maria Fernanda Perez",
      cedula_docente: "0912345678", nombre_capacitacion: "Planificación de DUA"
    }],
    datos_planificacion_capacitacion: [{
      id: "planning-1", id_documento: "planning-document-1", nombre_capacitacion: "Curso de Planificación DUA"
    }],
    datos_generales_informe: [{
      id: "final-1", id_documento: "final-document-1", nombre_capacitacion: "Planificacion DUA"
    }],
    participantes_informe: [{
      id: "final-participant-1", id_documento: "final-document-1", nombres_apellidos: "María Fernanda Pérez", cedula: "0912345678"
    }],
    datos_generales_instrumento: [{
      id: "instrument-1", id_documento: "instrument-document-1", nombre_capacitacion: "Planificación de DUA"
    }],
    participantes_instrumento_evaluacion: [{
      id: "instrument-participant-1", id_documento: "instrument-document-1", nombre_docente: "Maria Fernanda Perez", cedula_docente: "0912345678"
    }],
    datos_generales_informe_impacto: [{
      id: "impact-1", id_documento: "impact-document-1", nombre_capacitacion: "Planificación DUA"
    }],
    participantes_informe_impacto: [{
      id: "impact-participant-1", id_documento: "impact-document-1", nombre_participante: "María Fernanda Pérez", identificacion: "0912345678"
    }]
  };
  return {
    readCollection(name) { return collections[name] || []; }
  };
}

function runIndividualReportSelfTest() {
  const service = createIndividualReportService(createFakeDatabase());
  const teachers = service.listTeachers();
  assertCondition(teachers.length === 1, "No se listó el docente del Plan Individual.");
  assertCondition(teachers[0].cedula === "0912345678", "No se obtuvo la cédula desde el Acuerdo de Patrocinio.");
  assertCondition(teachers[0].puedeGenerar === true, "El reporte debería ser generable.");
  assertCondition(teachers[0].estadoGeneral === "COMPLETO", "La cadena documental completa no quedó en verde.");

  const result = service.prepareReport(teachers[0].key);
  assertCondition(result.ok === true, "No se pudo preparar el borrador del reporte.");
  assertCondition(result.report.capacitaciones[0].agreement.matchLevel !== "SIN_COINCIDENCIA", "No se relacionó el nombre variable del acuerdo.");
  assertCondition(result.report.capacitaciones[0].finalReport.teacherPresent === true, "No se encontró al docente por cédula en el Informe Final.");
  assertCondition(result.report.capacitaciones[0].evaluationInstrument.teacherPresent === true, "No se encontró al docente en el Instrumento de Evaluación.");
  assertCondition(result.report.capacitaciones[0].impactReport.teacherPresent === true, "No se encontró al docente en el Informe de Impacto.");

  return { ok: true, teachers: teachers.length, state: teachers[0].estadoGeneral };
}

if (require.main === module) {
  try {
    console.log("INDIVIDUAL_REPORT_SELFTEST_OK");
    console.log(JSON.stringify(runIndividualReportSelfTest(), null, 2));
  } catch (error) {
    console.error("INDIVIDUAL_REPORT_SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { createFakeDatabase, runIndividualReportSelfTest };
