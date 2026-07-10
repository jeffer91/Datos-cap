/* =========================================================
Nombre completo: plan-general-capacitacion.parser.test.js
Ruta o ubicación: /src/diagnostics/plan-general-capacitacion.parser.test.js
Función o funciones:
- Probar el parser del Plan Semestral de Capacitación Docente.
- Verificar objetivos, acciones, cronograma, indicadores y recursos.
- Confirmar ocho tablas y la regla de documento único por periodo.
========================================================= */

"use strict";

const { assertProcessor } = require("../core/processor.registry");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function createSyntheticGeneralPlan() {
  return {
    ok: true,
    index: 0,
    filePath: "UGPA-RGI2-01-PRO-70-2025-10-Plan-Capacitacion.pdf",
    fileName: "UGPA-RGI2-01-PRO-70-2025-10-Plan-Capacitacion.pdf",
    fileHash: "hash-sintetico-plan-general-capacitacion",
    pageCount: 25,
    extractionMethod: "digital",
    ocrPageCount: 0,
    ocrConfidence: 0,
    errors: [],
    warnings: [],
    text: `
Unidad de Gestión de Procesos Académicos
Código: UGPA-RGI2-01-PRO￾70-2025-10
Versión: 1.0
Fecha de Elaboración: 06 - octubre - 2025
Plan Semestral de Capacitación Docente. Octubre 2025 – Marzo 2026
Página 1 de 25
ELABORADO POR: REVISADO POR: APROBADO POR:
NOMBRE: MSc. Jefferson Villarreal NOMBRE: Ing. Martha Tomalá NOMBRE: Dr. Alex León T.
CARGO: COORDINADOR DE TITULACIÓN Y EFICIENCIA TERMINAL CARGO: COORDINADORA GENERAL DE CARRERAS CARGO: VICERRECTOR

1. Introducción
El plan responde a la Detección de Necesidades de Capacitación aprobada.

2. Objetivos del Plan:
Objetivo general: Fortalecer las competencias pedagógicas, tecnológicas y disciplinares del personal docente durante el período académico.
Objetivos específicos: Planificar una capacitación genérica institucional; Ejecutar capacitaciones específicas por carrera; Evaluar la participación y el impacto de las acciones formativas.

3. Capacitaciones Planificadas:
Capacitación 1:
Tipo: Genérica
Nivel de prioridad: Nivel 1
Carrera: Todas las carreras
Necesidad identificada: Desarrollo de contenidos de aprendizaje
Nombre de la capacitación: Desarrollador de Contenidos de Aprendizaje
Modalidad: Virtual
Fecha de inicio: 20 - octubre - 2025
Fecha de fin: 14 - noviembre - 2025
Duración en horas: 40
Beneficiarios: Personal docente institucional
Facilitador: Proveedor académico externo
Responsable: Unidad de Gestión de Procesos Académicos
Presupuesto: 1200.00
Fuente de financiamiento: Presupuesto institucional
Resultado esperado: Docentes capaces de estructurar contenidos de aprendizaje coherentes.
Estado: Planificada

Capacitación 2:
Tipo: Específica
Nivel de prioridad: Nivel 2
Carrera: Enfermería
Necesidad identificada: Manejo clínico del recién nacido
Nombre de la capacitación: Manejo Clínico del Recién Nacido
Modalidad: Híbrida
Fecha de inicio: 12 - enero - 2026
Fecha de fin: 30 - enero - 2026
Duración en horas: 32
Beneficiarios: Docentes de Enfermería
Facilitador: Especialista en neonatología
Responsable: Coordinación de Enfermería
Presupuesto: 800.00
Fuente de financiamiento: Presupuesto institucional
Resultado esperado: Actualización de competencias clínicas y pedagógicas neonatales.
Estado: Planificada

4. Cronograma de Ejecución:
Etapa 1:
Actividad: Socializar y ejecutar la capacitación genérica
Capacitación asociada: Desarrollador de Contenidos de Aprendizaje
Fecha de inicio: 20 - octubre - 2025
Fecha de fin: 14 - noviembre - 2025
Responsable: Unidad de Gestión de Procesos Académicos
Producto: Registro de asistencia, evaluaciones y certificados
Estado: Planificada

Etapa 2:
Actividad: Ejecutar la capacitación específica de Enfermería
Capacitación asociada: Manejo Clínico del Recién Nacido
Fecha de inicio: 12 - enero - 2026
Fecha de fin: 30 - enero - 2026
Responsable: Coordinación de Enfermería
Producto: Registro de asistencia, evaluación final y certificados
Estado: Planificada

5. Seguimiento y Evaluación:
Indicador 1:
Nombre: Cumplimiento de capacitaciones programadas
Fórmula: Capacitaciones ejecutadas dividido para capacitaciones planificadas por cien
Meta: 100 %
Frecuencia: Mensual
Medio de verificación: Informes finales y certificados
Responsable: Unidad de Gestión de Procesos Académicos
Momento de evaluación: Durante y al cierre del período
Uso del resultado: Ajustar el cronograma y las acciones correctivas.

Indicador 2:
Nombre: Participación docente
Fórmula: Docentes participantes dividido para docentes convocados por cien
Meta: Al menos 90 %
Frecuencia: Por capacitación
Medio de verificación: Listas de asistencia
Responsable: Responsable de cada capacitación
Momento de evaluación: Al cierre de cada capacitación
Uso del resultado: Mejorar la convocatoria y cobertura institucional.

6. Recursos y Presupuesto:
Recurso 1:
Tipo: Financiero
Descripción: Contratación de facilitadores y certificación
Cantidad: 1
Costo estimado: 1500.00
Fuente de financiamiento: Presupuesto institucional
Responsable: Vicerrectorado
Observación: Incluye capacitación genérica y específica.

Recurso 2:
Tipo: Tecnológico
Descripción: Plataformas virtuales, aulas y equipos
Cantidad: 2
Costo estimado: 500.00
Fuente de financiamiento: Recursos institucionales
Responsable: Unidad de Tecnología
Observación: Recursos compartidos para la ejecución del plan.

7. Responsables y Aprobación
El plan será ejecutado y evaluado por las unidades responsables.
Página 2 de 25 Página 3 de 25 Página 4 de 25 Página 25 de 25
`
  };
}

function runGeneralPlanParserTest() {
  const processor = assertProcessor("plan-general-capacitacion");
  const parseResult = processor.parseDocuments([createSyntheticGeneralPlan()]);
  assertCondition(parseResult.parsedCount === 1, "No se procesó el plan sintético.");
  assertCondition(parseResult.errorCount === 0, "El parser produjo errores inesperados.");

  const document = parseResult.parsed[0];
  const general = document.datos_generales;
  assertCondition(document.archivo.codigo_documento === "UGPA-RGI2-01-PRO-70-2025-10", "No se extrajo el código RGI2 PRO-70.");
  assertCondition(document.archivo.periodo === "2025-10", "No se extrajo el periodo.");
  assertCondition(document.archivo.documento_unico_periodo === "SI", "No se marcó como documento único.");
  assertCondition(document.archivo.inconsistencia_paginas === "NO", "Se detectó una inconsistencia de páginas inexistente.");
  assertCondition(general.periodo_documental_texto === "Octubre 2025 – Marzo 2026", "No se extrajo el alcance temporal.");
  assertCondition(general.tipo_plan === "SEMESTRAL", "No se clasificó el tipo de plan.");
  assertCondition(document.objetivos.length === 4, "No se extrajo un objetivo general y tres específicos.");
  assertCondition(document.capacitaciones.length === 2, "No se extrajeron dos capacitaciones.");
  assertCondition(document.capacitaciones[0].duracion_horas === 40, "No se extrajo la duración de la capacitación genérica.");
  assertCondition(document.capacitaciones[1].carrera === "Enfermería", "No se extrajo la carrera específica.");
  assertCondition(document.cronograma.length === 2, "No se extrajeron dos etapas del cronograma.");
  assertCondition(document.seguimiento.length === 2, "No se extrajeron dos indicadores.");
  assertCondition(document.recursos.length === 2, "No se extrajeron dos recursos.");
  assertCondition(general.presupuesto_total_estimado === 2000, "No se calculó el presupuesto total.");
  assertCondition(general.total_horas_planificadas === 72, "No se calcularon las horas planificadas.");
  assertCondition(document.responsables.length === 3, "No se extrajeron tres responsables.");

  const parseValidation = processor.validateParseResult(parseResult);
  assertCondition(parseValidation.warningCount === 0, "El plan sintético produjo advertencias esenciales.");

  const tableResult = processor.buildTables(parseResult);
  const tableValidation = processor.validateTableResult(tableResult);
  assertCondition(tableValidation.ok, "La estructura de ocho tablas no es válida.");
  assertCondition(tableResult.summary.total_tables === 8, "No se construyeron ocho tablas.");
  assertCondition(tableResult.summary.rows_by_table.capacitaciones_planificadas === 2, "La tabla de capacitaciones es incorrecta.");
  assertCondition(tableResult.summary.rows_by_table.seguimiento_plan_general_capacitacion === 2, "La tabla de seguimiento es incorrecta.");

  const multipleResult = processor.parseDocuments([createSyntheticGeneralPlan(), createSyntheticGeneralPlan()]);
  assertCondition(multipleResult.parsedCount === 0 && multipleResult.errorCount === 1, "No se aplicó la regla de documento único.");

  return {
    ok: true,
    documentId: document.id_documento,
    periodo: general.periodo_documental_texto,
    objetivos: document.objetivos.length,
    capacitaciones: document.capacitaciones.length,
    indicadores: document.seguimiento.length,
    recursos: document.recursos.length,
    presupuesto: general.presupuesto_total_estimado,
    summary: tableResult.summary
  };
}

if (require.main === module) {
  try {
    console.log("PLAN_GENERAL_CAPACITACION_PARSER_OK");
    console.log(JSON.stringify(runGeneralPlanParserTest(), null, 2));
  } catch (error) {
    console.error("PLAN_GENERAL_CAPACITACION_PARSER_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { createSyntheticGeneralPlan, runGeneralPlanParserTest };
