/* =========================================================
Nombre completo: report-data.repository.test.js
Ruta o ubicación: /src/diagnostics/report-data.repository.test.js
Función o funciones:
- Probar el mapa de las ocho fuentes documentales.
- Verificar normalización de personas, cursos, carreras y periodos.
- Confirmar exclusión de versiones superadas y propagación desde _documents.
- Detectar la limitación actual de participantes en Informe de Impacto.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const { LocalDatabase } = require("../database");
const {
  DOCUMENTS_COLLECTION,
  listCollections,
  createReportDataRepository,
  normalizePersonName,
  normalizeCourseName,
  normalizePeriod
} = require("../reporting");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function write(database, collection, records) {
  database.replaceCollection(collection, records);
}

function createDocument(id, type, options = {}) {
  return {
    id,
    id_documento: id,
    tipo_documental: type,
    nombre_tipo_documental: type,
    codigo_documento: options.code || `${type}-${id}`,
    periodo: options.period || "2026-03",
    nombre_archivo: `${id}.pdf`,
    hash_archivo: `hash-${id}`,
    activo: options.active !== false,
    estado_version: options.active === false ? "SUPERADO" : "ACTIVO",
    version_local: options.version || 1
  };
}

function seedDatabase(database) {
  const documents = [
    createDocument("doc-plan", "plan-individual"),
    createDocument("doc-acuerdo", "acuerdo-patrocinio"),
    createDocument("doc-planificacion", "planificacion-curso"),
    createDocument("doc-final", "informe-final"),
    createDocument("doc-evaluacion", "instrumento-evaluacion"),
    createDocument("doc-impacto", "informe-impacto"),
    createDocument("doc-necesidades", "deteccion-necesidades"),
    createDocument("doc-semestral", "plan-general-capacitacion"),
    createDocument("doc-semestral-viejo", "plan-general-capacitacion", { active: false, version: 1 })
  ];
  write(database, DOCUMENTS_COLLECTION, documents);

  write(database, "identificacion_docente", [{
    id: "identificacion-1",
    id_documento: "doc-plan",
    codigo_documento: "PLAN-1",
    nombre_docente: "Mgtr. María José Pérez",
    carrera: "Administración",
    requiere_revision: "NO"
  }]);
  write(database, "capacitaciones_propuestas", [{
    id: "capacitacion-1",
    id_documento: "doc-plan",
    codigo_documento: "PLAN-1",
    nombre_docente: "María José Pérez",
    carrera: "Administración",
    nombre_capacitacion: "Curso de Inteligencia Artificial para Docentes",
    horas_capacitacion: 40,
    requiere_revision: "NO"
  }]);
  write(database, "formacion_docente", [{
    id: "formacion-1",
    id_documento: "doc-plan",
    nombre_docente: "María José Pérez",
    carrera: "Administración",
    nombre_formacion: "Maestría en Educación",
    requiere_revision: "NO"
  }]);
  write(database, "capacidades_docente", [{
    id: "capacidad-1",
    id_documento: "doc-plan",
    nombre_docente: "María José Pérez",
    carrera: "Administración",
    requiere_revision: "NO"
  }]);

  write(database, "datos_acuerdo_patrocinio", [{
    id: "acuerdo-1",
    id_documento: "doc-acuerdo",
    periodo: "Marzo 2026",
    nombre_docente: "MARIA JOSE PEREZ",
    cedula_docente: "1712345678",
    carrera: "Administración",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }]);
  write(database, "apoyos_acuerdo_patrocinio", []);
  write(database, "responsables_acuerdo_patrocinio", []);

  write(database, "datos_generales_capacitacion", [{
    id: "planificacion-1",
    id_documento: "doc-planificacion",
    periodo: "2026/03",
    nombre_curso: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    facilitador: "Carlos Torres",
    requiere_revision: "NO"
  }]);
  write(database, "unidades_capacitacion", []);
  write(database, "evaluaciones_capacitacion", []);

  write(database, "datos_informe_final", [{
    id: "final-data-1",
    id_documento: "doc-final",
    periodo: "2026-03",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    requiere_revision: "NO"
  }]);
  write(database, "participantes_informe_final", [{
    id: "final-participant-1",
    id_documento: "doc-final",
    periodo: "2026-03",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    nombres_apellidos: "María José Pérez",
    cedula_identidad: "1712345678",
    requiere_revision: "NO"
  }]);
  write(database, "resultados_informe_final", []);
  write(database, "resumen_informe_final", []);
  write(database, "responsables_informe_final", []);

  write(database, "datos_instrumento_evaluacion", [{
    id: "evaluation-data-1",
    id_documento: "doc-evaluacion",
    periodo: "2026-03",
    nombre_curso: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    requiere_revision: "NO"
  }]);
  write(database, "participantes_instrumento_evaluacion", [{
    id: "evaluation-participant-1",
    id_documento: "doc-evaluacion",
    periodo: "2026-03",
    nombre_curso: "Inteligencia Artificial para Docentes",
    nombres_apellidos: "MARÍA JOSÉ PÉREZ",
    cedula_identidad: "1712345678",
    requiere_revision: "NO"
  }]);
  write(database, "indicadores_instrumento_evaluacion", []);
  write(database, "likert_instrumento_evaluacion", []);
  write(database, "objetivos_instrumento_evaluacion", []);
  write(database, "analisis_instrumento_evaluacion", []);
  write(database, "responsables_instrumento_evaluacion", []);

  write(database, "datos_informe_impacto", [{
    id: "impact-data-1",
    id_documento: "doc-impacto",
    periodo: "2026-03",
    nombre_curso: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    requiere_revision: "NO"
  }]);
  write(database, "indicadores_informe_impacto", []);
  write(database, "objetivos_informe_impacto", []);
  write(database, "metodologia_informe_impacto", []);
  write(database, "analisis_informe_impacto", []);
  write(database, "responsables_informe_impacto", []);

  write(database, "datos_deteccion_necesidades", [{
    id: "needs-data-1",
    id_documento: "doc-necesidades",
    periodo: "2026-03"
  }]);
  write(database, "necesidades_institucionales", []);
  write(database, "necesidades_por_carrera", []);
  write(database, "prioridades_por_carrera", [{
    id: "priority-1",
    id_documento: "doc-necesidades",
    periodo: "2026-03",
    carrera: "Administración",
    capacitacion_priorizada: "Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }]);
  write(database, "consolidado_deteccion_necesidades", []);
  write(database, "analisis_deteccion_necesidades", []);

  write(database, "datos_plan_general_capacitacion", [{
    id: "semester-data-1",
    id_documento: "doc-semestral",
    periodo: "2026-03"
  }, {
    id: "semester-data-old",
    id_documento: "doc-semestral-viejo",
    periodo: "2026-03"
  }]);
  write(database, "objetivos_plan_general_capacitacion", []);
  write(database, "capacitaciones_planificadas", [{
    id: "semester-training-1",
    id_documento: "doc-semestral",
    periodo: "2026-03",
    carrera: "Administración",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }, {
    id: "semester-training-old",
    id_documento: "doc-semestral-viejo",
    periodo: "2026-03",
    carrera: "Administración",
    nombre_capacitacion: "Curso antiguo que no debe aparecer",
    requiere_revision: "NO"
  }]);
  write(database, "cronograma_plan_general_capacitacion", []);
  write(database, "seguimiento_plan_general_capacitacion", []);
  write(database, "recursos_plan_general_capacitacion", []);
  write(database, "responsables_plan_general_capacitacion", []);
}

function runReportDataRepositoryTest() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-reporting-data-"));
  const database = new LocalDatabase(path.join(tempDirectory, "database"));
  database.initialize();
  seedDatabase(database);

  const repository = createReportDataRepository(database);
  const dictionary = repository.getDataDictionary();
  const snapshot = repository.loadSnapshot({ period: "Marzo 2026" });

  assertCondition(listCollections().length === 48, "El mapa de reportes no contiene las 48 colecciones requeridas más _documents.");
  assertCondition(dictionary.schemaVersion === 1, "La versión del diccionario es incorrecta.");
  assertCondition(Object.keys(dictionary.sources).length === 8, "El diccionario no contiene las ocho fuentes documentales.");
  assertCondition(snapshot.ok, "No se pudo construir el modelo consolidado.");
  assertCondition(snapshot.summary.documents === 8, "Las versiones superadas no fueron excluidas correctamente.");
  assertCondition(snapshot.summary.people === 1, "Las variantes del nombre y la cédula no se consolidaron en una persona.");
  assertCondition(snapshot.summary.courses === 1, "Las variantes del nombre del curso no se consolidaron.");
  assertCondition(snapshot.summary.personCourseLinks >= 4, "No se construyeron suficientes vínculos persona-curso.");
  assertCondition(snapshot.periods.includes("2026-03"), "No se normalizó el periodo Marzo 2026.");

  const person = snapshot.people[0];
  assertCondition(person.preferredIdentity === "1712345678", "No se priorizó la identificación de la persona.");
  assertCondition(person.preferredName.toLowerCase().includes("maría") || person.preferredName.toLowerCase().includes("maria"), "No se conservó el nombre preferido.");
  assertCondition(person.periods.some((period) => normalizePeriod(period) === "2026-03"), "No se propagó el periodo desde _documents.");

  const course = snapshot.courses[0];
  assertCondition(course.periodKey === "2026-03", "El curso no quedó asociado al periodo correcto.");
  assertCondition(course.sourceKeys.includes("coursePlanning"), "El curso no enlazó su planificación.");
  assertCondition(course.sourceKeys.includes("finalReport"), "El curso no enlazó el informe final.");
  assertCondition(course.sourceKeys.includes("evaluationInstrument"), "El curso no enlazó el instrumento de evaluación.");
  assertCondition(course.sourceKeys.includes("impactReport"), "El curso no enlazó el informe de impacto.");

  assertCondition(snapshot.globalInputs.needsDetection.careerPriorities.length === 1, "No se cargaron las prioridades de necesidades.");
  assertCondition(snapshot.globalInputs.semesterPlan.trainings.length === 1, "No se excluyeron filas del plan semestral superado.");
  assertCondition(snapshot.globalInputs.semesterPlan.trainings[0].nombre_capacitacion !== "Curso antiguo que no debe aparecer", "Se filtró incorrectamente una versión superada.");

  assertCondition(snapshot.capabilities.canResolveImpactParticipants === false, "Se declaró una capacidad de participantes de impacto que el esquema no tiene.");
  assertCondition(snapshot.issues.some((issue) => issue.code === "IMPACT_PARTICIPANTS_NOT_STORED"), "No se informó la limitación de participantes del informe de impacto.");
  assertCondition(normalizePersonName("Mgtr. María José Pérez") === normalizePersonName("MARIA JOSE PEREZ"), "La normalización de persona es inconsistente.");
  assertCondition(normalizeCourseName("Curso de Inteligencia Artificial para Docentes") === normalizeCourseName("Inteligencia Artificial para Docentes"), "La normalización del curso es inconsistente.");

  const withSuperseded = repository.loadSnapshot({ period: "2026-03", includeSuperseded: true });
  assertCondition(withSuperseded.summary.documents === 9, "No se pudo incluir el historial de versiones cuando fue solicitado.");
  assertCondition(withSuperseded.summary.courses === 2, "El historial no incorporó el curso de la versión superada.");

  return {
    ok: true,
    tempDirectory,
    dictionarySources: Object.keys(dictionary.sources).length,
    mappedCollections: listCollections().length,
    summary: snapshot.summary,
    person: {
      preferredName: person.preferredName,
      preferredIdentity: person.preferredIdentity,
      sources: person.sources.length
    },
    course: {
      preferredName: course.preferredName,
      sourceKeys: course.sourceKeys
    },
    issues: snapshot.issues
  };
}

if (require.main === module) {
  try {
    console.log("REPORT_DATA_REPOSITORY_OK");
    console.log(JSON.stringify(runReportDataRepositoryTest(), null, 2));
  } catch (error) {
    console.error("REPORT_DATA_REPOSITORY_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  createDocument,
  seedDatabase,
  runReportDataRepositoryTest
};
