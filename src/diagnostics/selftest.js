/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /src/diagnostics/selftest.js
Función o funciones:
- Probar Planes Individuales, Acuerdos de Patrocinio y base local.
- Verificar exportación Excel y JSON sin abrir Electron.
========================================================= */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const ids = require("../utils/ids");
const planTables = require("../tables");
const exporters = require("../exporters");
const agreement = require("../document-types/acuerdo-patrocinio");
const { createPersistenceService } = require("../database");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createPlanDocument() {
  const id = ids.createDocumentId("mock-plan.pdf", 0, "UGPA-RGI1-01-PRO-251-2026-03");
  return {
    id_documento: id,
    archivo: {
      id: ids.createRowId("archivo", id, 0, "mock-plan.pdf"), id_documento: id,
      nombre_archivo: "mock-plan.pdf", ruta_archivo: "mock-plan.pdf",
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03", numero_registro: "01",
      periodo: "2026-03", anio_periodo: "2026", mes_periodo: "03", total_paginas: 6,
      estado_extraccion: "OK", requiere_revision: "NO", observacion_extraccion: ""
    },
    identificacion: {
      id: ids.createRowId("identificacion", id, 0, "Docente Demo"), id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03", nombre_docente: "Docente Demo",
      tiempo_dedicacion: "Tiempo Completo", carrera: "Administración", funcion_sustantiva: "Docencia",
      nombre_firma_docente: "Docente Demo", nombre_aprobador: "Jefferson Villarreal",
      cargo_aprobador: "Gestor de Procesos Académicos", requiere_revision: "NO", observacion_extraccion: ""
    },
    capacidades: {
      id: ids.createRowId("capacidades", id, 0, "Docente Demo"), id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03", nombre_docente: "Docente Demo",
      carrera: "Administración", curso_actualizacion_ultimos_12_meses: "Curso Demo",
      avances_disciplinares_aplicados: "IA", comodidad_metodologias_nuevas: "Alta",
      estrategias_pedagogicas: "ABP", herramientas_tecnologicas: "Moodle",
      formacion_adicional_necesaria: "Analítica", nivel_academico_actual: "Maestría",
      tipo_formacion_propuesta: "Específica", requiere_revision: "NO", observacion_extraccion: ""
    },
    capacitaciones: [{
      id: ids.createRowId("capacitacion", id, 0, "Curso Demo"), id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03", nombre_docente: "Docente Demo",
      carrera: "Administración", nombre_capacitacion: "Curso Demo", horas_capacitacion: "40",
      fecha_inicio_capacitacion: "01/03/2026", fecha_fin_capacitacion: "31/03/2026",
      fecha_texto_original: "01/03/2026 al 31/03/2026", tipo_capacitacion: "Aprobación",
      requiere_revision: "NO", observacion_extraccion: ""
    }],
    formacion: [{
      id: ids.createRowId("formacion", id, 0, "Maestría"), id_documento: id,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03", nombre_docente: "Docente Demo",
      carrera: "Administración", situacion_actual_formacion: "Maestría",
      situacion_propuesta_formacion: "Doctorado", tiempo_esperado_cumplimiento: "24 meses",
      nombre_formacion: "Doctorado en Educación", nivel_academico_formacion: "Doctorado",
      tipo_formacion: "Específica", requiere_revision: "NO", observacion_extraccion: ""
    }]
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
Financiamiento parcial del costo del curso (indicar porcentaje: %)
Anticipo de sueldos/honorarios
Cambio temporal en modalidad de trabajo
Licencia con remuneración
Licencia sin remuneración
Ajuste de horario laboral
COMPROMISOS DEL COLABORADOR`;
  return agreement.parser.parseDocument({
    text, fileName: "mock-acuerdo.pdf", filePath: "mock-acuerdo.pdf", index: 0, pageCount: 3, ok: true
  });
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-selftest-"));
  const planDocument = createPlanDocument();
  const agreementDocument = createAgreementDocument();
  const planResult = planTables.buildAllTables([planDocument]);
  const agreementResult = agreement.tables.buildTables([agreementDocument]);

  assertCondition(planResult.summary.total_tables === 5, "No se construyeron las 5 tablas de Planes.");
  assertCondition(agreementResult.summary.total_tables === 4, "No se construyeron las 4 tablas de Acuerdos.");
  assertCondition(agreementDocument.datos_acuerdo.cedula_docente === "1314227487", "No se extrajo la cédula del acuerdo.");
  assertCondition(agreementDocument.apoyos.some((row) => row.seleccionado === "SI"), "No se detectó el apoyo marcado.");

  const planExport = exporters.exportAll({
    outputDir: tempDir, baseName: "selftest_plan", tables: planResult.tables,
    summary: planResult.summary, validations: planResult.validations, warnings: [], errors: []
  });
  const agreementExport = exporters.exportAll({
    outputDir: tempDir, baseName: "selftest_acuerdo", tables: agreementResult.tables,
    summary: agreementResult.summary, validations: agreementResult.validations, warnings: [], errors: []
  });
  assertCondition(fs.existsSync(planExport.files.excel.filePath), "No se creó el Excel de Planes.");
  assertCondition(fs.existsSync(agreementExport.files.json.filePath), "No se creó el JSON de Acuerdos.");

  const persistence = createPersistenceService(path.join(tempDir, "database"));
  const saved = persistence.persistProcessingResult({
    documentType: "acuerdo-patrocinio", parsedDocuments: [agreementDocument],
    tables: agreementResult.tables, summary: agreementResult.summary, outputDir: tempDir
  });
  persistence.completeRun(saved.runId, { ok: true, files: agreementExport.files });
  assertCondition(persistence.getSummary().agreementCount === 1, "El acuerdo no se guardó en la base local.");

  return {
    ok: true,
    tempDir,
    planTables: planResult.summary.total_tables,
    agreementTables: agreementResult.summary.total_tables,
    database: persistence.getSummary(),
    files: { plan: planExport.files, agreement: agreementExport.files }
  };
}

if (require.main === module) {
  try {
    console.log("SELFTEST_OK");
    console.log(JSON.stringify(runSelfTest(), null, 2));
  } catch (error) {
    console.error("SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { createPlanDocument, createAgreementDocument, runSelfTest };
