/* =========================================================
Nombre completo: selftest.js
Ruta o ubicación: /plan-docente-extractor/src/diagnostics/selftest.js
Función o funciones:
- Ejecutar una prueba rápida de módulos críticos sin abrir Electron.
- Verificar que existan funciones principales de extractor, tablas y exportadores.
- Crear tablas simuladas y validar exportación JSON/Excel en carpeta temporal.
- Ayudar a detectar errores de instalación o rutas antes de usar la app.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const ids = require("../utils/ids");
const normalizer = require("../extractor/normalizer");
const tables = require("../tables");
const exporters = require("../exporters");

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createMockParsedDocument() {
  const idDocumento = ids.createDocumentId("mock-plan.pdf", 0, "UGPA-RGI1-01-PRO-251-2026-03");

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
        id: ids.createRowId("formacion", idDocumento, 0, "Maestría Demo"),
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plan-docente-test-"));
  const mockDocument = createMockParsedDocument();

  assertCondition(typeof ids.createDocumentId === "function", "ids.createDocumentId no está disponible.");
  assertCondition(typeof normalizer.normalizeSpaces === "function", "normalizer.normalizeSpaces no está disponible.");
  assertCondition(typeof tables.buildAllTables === "function", "tables.buildAllTables no está disponible.");
  assertCondition(typeof exporters.exportAll === "function", "exporters.exportAll no está disponible.");

  const tableResult = tables.buildAllTables([mockDocument]);
  assertCondition(tableResult.summary.total_tables === 5, "No se construyeron las 5 tablas esperadas.");
  assertCondition(tableResult.summary.total_rows >= 5, "Las tablas generadas no tienen filas suficientes.");

  const exportResult = exporters.exportAll({
    outputDir: tempDir,
    baseName: "selftest_reporte_plan_individual",
    tables: tableResult.tables,
    summary: tableResult.summary,
    validations: tableResult.validations,
    warnings: tables.flattenValidationWarnings(tableResult.validations),
    errors: []
  });

  assertCondition(exportResult.ok, "La exportación general no devolvió ok=true.");
  assertCondition(fs.existsSync(exportResult.files.excel.filePath), "No se creó el archivo Excel de prueba.");
  assertCondition(fs.existsSync(exportResult.files.json.filePath), "No se creó el archivo JSON de prueba.");

  return {
    ok: true,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    tempDir,
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
