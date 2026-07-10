/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /src/diagnostics/selftest.js
Función o funciones:
- Ejecutar una prueba rápida de módulos críticos sin abrir Electron.
- Verificar el registro de ocho tipos y tres procesadores activos.
- Validar el módulo especializado del Plan Individual.
- Comprobar exportación Excel + JSON y lectores híbridos.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ids = require("../utils/ids");
const normalizer = require("../extractor/normalizer");
const exporters = require("../exporters");
const { listDocumentTypes, getDocumentType } = require("../core/document-type.registry");
const { assertProcessor, listProcessorIds, listProcessors } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createMockParsedDocument() {
  const idDocumento = ids.createDocumentId(
    "mock-plan.pdf",
    0,
    "UGPA-RGI1-01-PRO-251-2026-03",
    "hash-documento-demo",
    "plan-individual"
  );

  return {
    id_documento: idDocumento,
    archivo: {
      id: ids.createRowId("archivo", idDocumento, 0, "mock-plan.pdf"),
      id_documento: idDocumento,
      nombre_archivo: "mock-plan.pdf",
      ruta_archivo: "mock-plan.pdf",
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      numero_registro: "01",
      periodo: "2026-03",
      anio_periodo: "2026",
      mes_periodo: "03",
      total_paginas: 5,
      estado_extraccion: "OK",
      requiere_revision: "NO",
      observacion_extraccion: ""
    },
    identificacion: {
      id: ids.createRowId("identificacion", idDocumento, 0, "Docente Demo"),
      id_documento: idDocumento,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      nombre_docente: "Docente Demo",
      tiempo_dedicacion: "Tiempo Completo",
      carrera: "Desarrollo de Software",
      funcion_sustantiva: "Docencia",
      nombre_firma_docente: "Docente Demo",
      nombre_aprobador: "Gestor Demo",
      cargo_aprobador: "Gestor de Procesos Académicos",
      requiere_revision: "NO",
      observacion_extraccion: ""
    },
    capacidades: {
      id: ids.createRowId("capacidades", idDocumento, 0, "Docente Demo"),
      id_documento: idDocumento,
      codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
      nombre_docente: "Docente Demo",
      carrera: "Desarrollo de Software",
      curso_actualizacion_ultimos_12_meses: "Innovación educativa",
      avances_disciplinares_aplicados: "Inteligencia artificial aplicada",
      comodidad_metodologias_nuevas: "Alta",
      estrategias_pedagogicas: "Aprendizaje basado en proyectos",
      herramientas_tecnologicas: "Moodle, Teams, Canva",
      formacion_adicional_necesaria: "Analítica educativa",
      nivel_academico_actual: "Maestría",
      tipo_formacion_propuesta: "Específica",
      requiere_revision: "NO",
      observacion_extraccion: ""
    },
    capacitaciones: [
      {
        id: ids.createRowId("capacitacion", idDocumento, 0, "Curso Demo"),
        id_documento: idDocumento,
        codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
        nombre_docente: "Docente Demo",
        carrera: "Desarrollo de Software",
        numero_capacitacion: 1,
        nombre_capacitacion: "Curso Demo de Innovación Educativa",
        horas_capacitacion: "40",
        fecha_inicio_capacitacion: "01/03/2026",
        fecha_fin_capacitacion: "31/03/2026",
        fecha_texto_original: "01/03/2026 al 31/03/2026",
        tipo_capacitacion: "Aprobación",
        requiere_revision: "NO",
        observacion_extraccion: ""
      }
    ],
    formacion: [
      {
        id: ids.createRowId("formacion", idDocumento, 0, "Doctorado Demo"),
        id_documento: idDocumento,
        codigo_documento: "UGPA-RGI1-01-PRO-251-2026-03",
        nombre_docente: "Docente Demo",
        carrera: "Desarrollo de Software",
        numero_formacion: 1,
        situacion_actual_formacion: "Maestría",
        situacion_propuesta_formacion: "Doctorado",
        tiempo_esperado_cumplimiento: "24 meses",
        nombre_formacion: "Doctorado en Educación e Innovación",
        nivel_academico_formacion: "Doctorado",
        tipo_formacion: "Específica",
        fecha_inicio_formacion: "",
        fecha_fin_formacion: "",
        requiere_revision: "NO",
        observacion_extraccion: ""
      }
    ]
  };
}

function runSelfTest() {
  const startedAt = new Date();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gestor-documental-test-"));
  const mockDocument = createMockParsedDocument();
  const documentTypes = listDocumentTypes();
  const processorIds = listProcessorIds();
  const processorDetails = listProcessors();
  const planDefinition = getDocumentType("plan-individual");
  const planningDefinition = getDocumentType("planificacion-curso");
  const agreementDefinition = getDocumentType("acuerdo-patrocinio");
  const planProcessor = assertProcessor("plan-individual");
  const planningProcessor = assertProcessor("planificacion-curso");
  const agreementProcessor = assertProcessor("acuerdo-patrocinio");

  assertCondition(documentTypes.length === 8, "No están registrados los 8 tipos documentales.");
  assertCondition(processorIds.length === 3, "Deben existir exactamente tres procesadores activos en esta etapa.");
  assertCondition(processorIds.includes("plan-individual"), "El procesador del Plan Individual no está registrado.");
  assertCondition(processorIds.includes("planificacion-curso"), "El procesador de Planificación por Curso no está registrado.");
  assertCondition(processorIds.includes("acuerdo-patrocinio"), "El procesador de Acuerdos de Patrocinio no está registrado.");
  assertCondition(Boolean(planDefinition && planDefinition.enabled), "El módulo Plan Individual no está activo.");
  assertCondition(Boolean(planningDefinition && planningDefinition.enabled), "El módulo Planificación por Curso no está activo.");
  assertCondition(Boolean(agreementDefinition && agreementDefinition.enabled), "El módulo Acuerdo de Patrocinio no está activo.");
  assertCondition(planDefinition.tables.length === 5, "El Plan Individual no declara sus 5 tablas.");
  assertCondition(planningDefinition.tables.length === 4, "La Planificación por Curso no declara sus 4 tablas.");
  assertCondition(agreementDefinition.tables.length === 4, "El Acuerdo de Patrocinio no declara sus 4 tablas.");
  assertCondition(typeof planningProcessor.readDocuments === "function", "El módulo de planificación no expone lector híbrido.");
  assertCondition(typeof agreementProcessor.readDocuments === "function", "El módulo de acuerdos no expone lector híbrido.");
  assertCondition(typeof agreementProcessor.parseDocuments === "function", "El módulo de acuerdos no expone parser.");
  assertCondition(typeof agreementProcessor.buildTables === "function", "El módulo de acuerdos no expone tablas.");
  assertCondition(typeof ids.createDocumentId === "function", "ids.createDocumentId no está disponible.");
  assertCondition(ids.extractRegistroFromCodigo("CGC-RGI2-146-PRO-134-2025-03") === "146", "No se reconoce el registro de códigos CGC.");
  assertCondition(typeof normalizer.normalizeSpaces === "function", "normalizer.normalizeSpaces no está disponible.");
  assertCondition(typeof exporters.exportAll === "function", "exporters.exportAll no está disponible.");

  const parseResult = {
    documentType: "plan-individual",
    total: 1,
    parsedCount: 1,
    errorCount: 0,
    parsed: [mockDocument],
    errors: []
  };
  const parseValidation = planProcessor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El documento simulado produjo advertencias inesperadas.");

  const tableResult = planProcessor.buildTables(parseResult);
  const structureValidation = planProcessor.validateTableResult(tableResult);
  assertCondition(structureValidation.ok, "La estructura modular de tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 5, "No se construyeron las 5 tablas esperadas.");
  assertCondition(tableResult.summary.total_rows >= 5, "Las tablas generadas no tienen filas suficientes.");

  const sheetLabels = planDefinition.tables.reduce((output, table) => {
    output[table.name] = table.sheet;
    return output;
  }, {});

  const exportResult = exporters.exportAll({
    outputDir: tempDir,
    baseName: "selftest_reporte_plan_individual",
    documentType: planDefinition.id,
    documentLabel: planDefinition.label,
    sheetOrder: planDefinition.tables.map((table) => table.name),
    sheetLabels,
    tables: tableResult.tables,
    summary: tableResult.summary,
    validations: {
      parseo: parseValidation,
      tablas: tableResult.validations,
      estructura: structureValidation
    },
    warnings: planProcessor.flattenWarnings(tableResult.validations),
    errors: []
  });

  assertCondition(exportResult.ok, "La exportación general no devolvió ok=true.");
  assertCondition(exportResult.documentType === "plan-individual", "El exportador no conserva el tipo documental.");
  assertCondition(fs.existsSync(exportResult.files.excel.filePath), "No se creó el archivo Excel de prueba.");
  assertCondition(fs.existsSync(exportResult.files.json.filePath), "No se creó el archivo JSON de prueba.");

  const jsonPayload = JSON.parse(fs.readFileSync(exportResult.files.json.filePath, "utf8"));
  assertCondition(jsonPayload.metadata.tipo_documental === "plan-individual", "El JSON no conserva el tipo documental.");
  assertCondition(Object.keys(jsonPayload.tablas || {}).length === 5, "El JSON no contiene las cinco tablas.");

  return {
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    tempDir,
    documentTypes: documentTypes.map((item) => item.id),
    processors: processorDetails,
    files: exportResult.files,
    summary: tableResult.summary
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
  createMockParsedDocument,
  runSelfTest
};
