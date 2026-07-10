/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /src/diagnostics/selftest.js
Función o funciones:
- Ejecutar una prueba rápida de módulos críticos sin abrir Electron.
- Verificar el registro de ocho tipos y procesadores implementados.
- Validar el módulo especializado del Plan Individual.
- Crear tablas simuladas y comprobar exportación Excel + JSON.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ids = require("../utils/ids");
const normalizer = require("../extractor/normalizer");
const exporters = require("../exporters");
const { listDocumentTypes, getDocumentType } = require("../core/document-type.registry");
const { assertProcessor, listProcessorIds } = require("../core/processor.registry");

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
  const planDefinition = getDocumentType("plan-individual");
  const planProcessor = assertProcessor("plan-individual");

  assertCondition(documentTypes.length === 8, "No están registrados los 8 tipos documentales.");
  assertCondition(processorIds.includes("plan-individual"), "El procesador modular del Plan Individual no está registrado.");
  assertCondition(Boolean(planDefinition && planDefinition.enabled), "El módulo Plan Individual no está activo.");
  assertCondition(planDefinition.processorId === "plan-individual", "El Plan Individual todavía apunta al procesador heredado.");
  assertCondition(planDefinition.tables.length === 5, "El Plan Individual no declara sus 5 tablas.");
  assertCondition(typeof ids.createDocumentId === "function", "ids.createDocumentId no está disponible.");
  assertCondition(typeof normalizer.normalizeSpaces === "function", "normalizer.normalizeSpaces no está disponible.");
  assertCondition(typeof planProcessor.parseDocuments === "function", "El módulo no expone parseDocuments.");
  assertCondition(typeof planProcessor.buildTables === "function", "El módulo no expone buildTables.");
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
    processors: processorIds,
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
