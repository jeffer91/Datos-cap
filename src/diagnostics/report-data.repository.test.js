/* =========================================================
Nombre completo: report-data.repository.test.js
Ruta o ubicación: /src/diagnostics/report-data.repository.test.js
Función o funciones:
- Probar el mapa completo de las ocho fuentes y 51 colecciones.
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

function replace(database, collection, records) {
  database.replaceCollection(collection, records);
}

function documentRecord(id, type, active = true) {
  return {
    id,
    id_documento: id,
    tipo_documental: type,
    nombre_tipo_documental: type,
    codigo_documento: `${type}-${id}`,
    periodo: "2026-03",
    nombre_archivo: `${id}.pdf`,
    hash_archivo: `hash-${id}`,
    activo: active,
    estado_version: active ? "ACTIVO" : "SUPERADO",
    version_local: active ? 2 : 1
  };
}

function seed(database) {
  listCollections().filter((name) => name !== DOCUMENTS_COLLECTION).forEach((name) => replace(database, name, []));

  replace(database, DOCUMENTS_COLLECTION, [
    documentRecord("doc-plan", "plan-individual"),
    documentRecord("doc-acuerdo", "acuerdo-patrocinio"),
    documentRecord("doc-planificacion", "planificacion-curso"),
    documentRecord("doc-final", "informe-final"),
    documentRecord("doc-evaluacion", "instrumento-evaluacion"),
    documentRecord("doc-impacto", "informe-impacto"),
    documentRecord("doc-necesidades", "deteccion-necesidades"),
    documentRecord("doc-semestral", "plan-general-capacitacion"),
    documentRecord("doc-semestral-viejo", "plan-general-capacitacion", false)
  ]);

  replace(database, "identificacion_docente", [{
    id: "persona-plan",
    id_documento: "doc-plan",
    nombre_docente: "Mgtr. María José Pérez",
    carrera: "Administración",
    requiere_revision: "NO"
  }]);
  replace(database, "capacitaciones_propuestas", [{
    id: "curso-plan",
    id_documento: "doc-plan",
    nombre_docente: "María José Pérez",
    carrera: "Administración",
    nombre_capacitacion: "Curso de Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }]);
  replace(database, "formacion_docente", [{
    id: "formacion-plan",
    id_documento: "doc-plan",
    nombre_docente: "María José Pérez",
    carrera: "Administración",
    nombre_formacion: "Maestría en Educación",
    requiere_revision: "NO"
  }]);

  replace(database, "datos_acuerdo_patrocinio", [{
    id: "acuerdo-data",
    id_documento: "doc-acuerdo",
    periodo: "Marzo 2026",
    nombre_docente: "MARIA JOSE PEREZ",
    cedula_docente: "1712345678",
    carrera: "Administración",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }]);

  replace(database, "datos_generales_capacitacion", [{
    id: "planificacion-data",
    id_documento: "doc-planificacion",
    periodo: "2026/03",
    nombre_curso: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    facilitador: "Carlos Torres",
    requiere_revision: "NO"
  }]);

  replace(database, "datos_informe_final", [{
    id: "final-data",
    id_documento: "doc-final",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    requiere_revision: "NO"
  }]);
  replace(database, "participantes_informe_final", [{
    id: "final-persona",
    id_documento: "doc-final",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    nombres_apellidos: "María José Pérez",
    cedula_identidad: "1712345678",
    requiere_revision: "NO"
  }]);

  replace(database, "datos_instrumento_evaluacion", [{
    id: "evaluacion-data",
    id_documento: "doc-evaluacion",
    nombre_curso: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    requiere_revision: "NO"
  }]);
  replace(database, "participantes_instrumento_evaluacion", [{
    id: "evaluacion-persona",
    id_documento: "doc-evaluacion",
    nombre_curso: "Inteligencia Artificial para Docentes",
    nombres_apellidos: "MARÍA JOSÉ PÉREZ",
    cedula_identidad: "1712345678",
    requiere_revision: "NO"
  }]);

  replace(database, "datos_informe_impacto", [{
    id: "impacto-data",
    id_documento: "doc-impacto",
    nombre_curso: "Inteligencia Artificial para Docentes",
    carrera_publico: "Administración",
    requiere_revision: "NO"
  }]);

  replace(database, "prioridades_por_carrera", [{
    id: "necesidad-prioridad",
    id_documento: "doc-necesidades",
    carrera: "Administración",
    capacitacion_priorizada: "Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }]);

  replace(database, "capacitaciones_planificadas", [{
    id: "semestral-activa",
    id_documento: "doc-semestral",
    carrera: "Administración",
    nombre_capacitacion: "Inteligencia Artificial para Docentes",
    requiere_revision: "NO"
  }, {
    id: "semestral-superada",
    id_documento: "doc-semestral-viejo",
    carrera: "Administración",
    nombre_capacitacion: "Curso antiguo que no debe aparecer",
    requiere_revision: "NO"
  }]);
}

function runReportDataRepositoryTest() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-reporting-data-"));
  const database = new LocalDatabase(path.join(tempDirectory, "database"));
  database.initialize();
  seed(database);

  const repository = createReportDataRepository(database);
  const dictionary = repository.getDataDictionary();
  const snapshot = repository.loadSnapshot({ period: "Marzo 2026" });

  assertCondition(listCollections().length === 52, "El mapa debe incluir _documents y las 51 colecciones documentales.");
  assertCondition(Object.keys(dictionary.sources).length === 8, "El diccionario no contiene las ocho fuentes.");
  assertCondition(snapshot.summary.documents === 8, "No se excluyó la versión superada.");
  assertCondition(snapshot.summary.people === 1, "Las variantes de persona no se consolidaron.");
  assertCondition(snapshot.summary.courses === 1, "Las variantes de curso no se consolidaron.");
  assertCondition(snapshot.summary.personCourseLinks >= 4, "Faltan vínculos persona-curso.");
  assertCondition(snapshot.periods.includes("2026-03"), "No se normalizó el periodo.");

  const person = snapshot.people[0];
  assertCondition(person.preferredIdentity === "1712345678", "No se priorizó la cédula.");
  assertCondition(person.periods.some((value) => normalizePeriod(value) === "2026-03"), "No se propagó el periodo maestro.");

  const course = snapshot.courses[0];
  ["coursePlanning", "finalReport", "evaluationInstrument", "impactReport"].forEach((sourceKey) => {
    assertCondition(course.sourceKeys.includes(sourceKey), `El curso no enlazó ${sourceKey}.`);
  });

  assertCondition(snapshot.globalInputs.needsDetection.careerPriorities.length === 1, "No se leyó Detección de Necesidades.");
  assertCondition(snapshot.globalInputs.semesterPlan.trainings.length === 1, "No se filtró la versión superada del Plan Semestral.");
  assertCondition(snapshot.capabilities.mappedDocumentCollections === 51, "La capacidad no reporta las 51 colecciones.");
  assertCondition(snapshot.capabilities.canResolveImpactParticipants === false, "Se declaró una capacidad inexistente.");
  assertCondition(snapshot.issues.some((issue) => issue.code === "IMPACT_PARTICIPANTS_NOT_STORED"), "No se reportó la limitación del Informe de Impacto.");
  assertCondition(normalizePersonName("Mgtr. María José Pérez") === normalizePersonName("MARIA JOSE PEREZ"), "La persona no se normaliza de forma estable.");
  assertCondition(normalizeCourseName("Curso de Inteligencia Artificial para Docentes") === normalizeCourseName("Inteligencia Artificial para Docentes"), "El curso no se normaliza de forma estable.");

  const historical = repository.loadSnapshot({ period: "2026-03", includeSuperseded: true });
  assertCondition(historical.summary.documents === 9, "No se pudo incluir el historial.");
  assertCondition(historical.summary.courses === 2, "El historial no incorporó el curso superado.");

  return {
    ok: true,
    tempDirectory,
    mappedCollections: listCollections().length,
    sources: Object.keys(dictionary.sources).length,
    summary: snapshot.summary,
    person: person.preferredName,
    course: course.preferredName,
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
  documentRecord,
  seed,
  runReportDataRepositoryTest
};
