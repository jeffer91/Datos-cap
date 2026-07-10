/* =========================================================
Nombre completo: reporting-schema.registry.js
Ruta o ubicación: /src/reporting/schema/reporting-schema.registry.js
Función o funciones:
- Declarar las colecciones que alimentarán reportes individuales y globales.
- Mapear campos equivalentes de persona, curso, periodo y carrera.
- Identificar fuentes de documentos, participantes, resultados y análisis.
- Exponer capacidades y limitaciones actuales de trazabilidad.
========================================================= */

"use strict";

const REPORTING_SCHEMA_VERSION = 1;

const DOCUMENTS_COLLECTION = "_documents";
const REPORT_RUNS_COLLECTION = "_report_generation_runs";

const SOURCES = Object.freeze({
  planIndividual: Object.freeze({
    documentType: "plan-individual",
    collections: Object.freeze({
      identification: "identificacion_docente",
      trainings: "capacitaciones_propuestas",
      education: "formacion_docente",
      capabilities: "capacidades_docente"
    }),
    personFields: Object.freeze(["nombre_docente"]),
    identityFields: Object.freeze([]),
    careerFields: Object.freeze(["carrera"]),
    courseFields: Object.freeze(["nombre_capacitacion"]),
    periodFields: Object.freeze(["periodo"])
  }),

  sponsorshipAgreement: Object.freeze({
    documentType: "acuerdo-patrocinio",
    collections: Object.freeze({
      data: "datos_acuerdo_patrocinio",
      supports: "apoyos_acuerdo_patrocinio",
      responsible: "responsables_acuerdo_patrocinio"
    }),
    personFields: Object.freeze(["nombre_docente", "docente"]),
    identityFields: Object.freeze(["cedula_docente"]),
    careerFields: Object.freeze(["carrera"]),
    courseFields: Object.freeze(["nombre_capacitacion", "capacitacion"]),
    periodFields: Object.freeze(["periodo"])
  }),

  coursePlanning: Object.freeze({
    documentType: "planificacion-curso",
    collections: Object.freeze({
      data: "datos_generales_capacitacion",
      units: "unidades_capacitacion",
      evaluations: "evaluaciones_capacitacion"
    }),
    personFields: Object.freeze(["facilitador"]),
    identityFields: Object.freeze([]),
    careerFields: Object.freeze(["carrera_publico"]),
    courseFields: Object.freeze(["nombre_curso"]),
    periodFields: Object.freeze(["periodo"])
  }),

  finalReport: Object.freeze({
    documentType: "informe-final",
    collections: Object.freeze({
      data: "datos_informe_final",
      participants: "participantes_informe_final",
      results: "resultados_informe_final",
      summary: "resumen_informe_final",
      responsible: "responsables_informe_final"
    }),
    personFields: Object.freeze(["nombres_apellidos"]),
    identityFields: Object.freeze(["cedula_identidad"]),
    careerFields: Object.freeze(["carrera_publico"]),
    courseFields: Object.freeze(["nombre_capacitacion"]),
    periodFields: Object.freeze(["periodo"])
  }),

  evaluationInstrument: Object.freeze({
    documentType: "instrumento-evaluacion",
    collections: Object.freeze({
      data: "datos_instrumento_evaluacion",
      participants: "participantes_instrumento_evaluacion",
      indicators: "indicadores_instrumento_evaluacion",
      likert: "likert_instrumento_evaluacion",
      objectives: "objetivos_instrumento_evaluacion",
      analysis: "analisis_instrumento_evaluacion",
      responsible: "responsables_instrumento_evaluacion"
    }),
    personFields: Object.freeze(["nombres_apellidos"]),
    identityFields: Object.freeze(["cedula_identidad"]),
    careerFields: Object.freeze(["carrera_publico"]),
    courseFields: Object.freeze(["nombre_curso"]),
    periodFields: Object.freeze(["periodo"])
  }),

  impactReport: Object.freeze({
    documentType: "informe-impacto",
    collections: Object.freeze({
      data: "datos_informe_impacto",
      indicators: "indicadores_informe_impacto",
      objectives: "objetivos_informe_impacto",
      methodology: "metodologia_informe_impacto",
      analysis: "analisis_informe_impacto",
      responsible: "responsables_informe_impacto"
    }),
    personFields: Object.freeze(["nombres_apellidos", "nombre_docente", "participante"]),
    identityFields: Object.freeze(["cedula_identidad", "cedula_docente"]),
    careerFields: Object.freeze(["carrera_publico"]),
    courseFields: Object.freeze(["nombre_curso"]),
    periodFields: Object.freeze(["periodo"]),
    participantCollection: ""
  }),

  needsDetection: Object.freeze({
    documentType: "deteccion-necesidades",
    collections: Object.freeze({
      data: "datos_deteccion_necesidades",
      institutional: "necesidades_institucionales",
      careerNeeds: "necesidades_por_carrera",
      careerPriorities: "prioridades_por_carrera",
      consolidated: "consolidado_deteccion_necesidades",
      analysis: "analisis_deteccion_necesidades"
    }),
    personFields: Object.freeze([]),
    identityFields: Object.freeze([]),
    careerFields: Object.freeze(["carrera"]),
    courseFields: Object.freeze(["capacitacion", "capacitacion_priorizada", "necesidad_capacitacion"]),
    periodFields: Object.freeze(["periodo"])
  }),

  semesterPlan: Object.freeze({
    documentType: "plan-general-capacitacion",
    collections: Object.freeze({
      data: "datos_plan_general_capacitacion",
      objectives: "objetivos_plan_general_capacitacion",
      trainings: "capacitaciones_planificadas",
      schedule: "cronograma_plan_general_capacitacion",
      monitoring: "seguimiento_plan_general_capacitacion",
      resources: "recursos_plan_general_capacitacion",
      responsible: "responsables_plan_general_capacitacion"
    }),
    personFields: Object.freeze(["beneficiarios", "responsable_ejecucion"]),
    identityFields: Object.freeze([]),
    careerFields: Object.freeze(["carrera"]),
    courseFields: Object.freeze(["nombre_capacitacion", "capacitacion_asociada"]),
    periodFields: Object.freeze(["periodo"])
  })
});

const PERSON_SOURCE_KEYS = Object.freeze([
  "planIndividual",
  "sponsorshipAgreement",
  "finalReport",
  "evaluationInstrument"
]);

const COURSE_SOURCE_KEYS = Object.freeze([
  "planIndividual",
  "sponsorshipAgreement",
  "coursePlanning",
  "finalReport",
  "evaluationInstrument",
  "impactReport",
  "needsDetection",
  "semesterPlan"
]);

const INDIVIDUAL_EVIDENCE_KEYS = Object.freeze([
  "planIndividual",
  "sponsorshipAgreement",
  "coursePlanning",
  "finalReport",
  "finalReportParticipant",
  "evaluationInstrument",
  "evaluationParticipant",
  "impactReport",
  "impactParticipant"
]);

function listSourceKeys() {
  return Object.keys(SOURCES);
}

function listCollections() {
  return [...new Set([
    DOCUMENTS_COLLECTION,
    ...Object.values(SOURCES).flatMap((source) => Object.values(source.collections))
  ])];
}

function getSource(sourceKey) {
  return SOURCES[String(sourceKey || "").trim()] || null;
}

function getSourceByDocumentType(documentType) {
  const type = String(documentType || "").trim();
  return Object.entries(SOURCES).find(([, source]) => source.documentType === type) || null;
}

function getReportingCapabilities() {
  return {
    schemaVersion: REPORTING_SCHEMA_VERSION,
    canReadAllEightDocumentTypes: true,
    canBuildPersonIndex: true,
    canBuildCourseIndex: true,
    canResolvePeriodsFromDocumentMaster: true,
    canResolveFinalReportParticipants: true,
    canResolveEvaluationParticipants: true,
    canResolveImpactParticipants: Boolean(SOURCES.impactReport.participantCollection),
    impactParticipantLimitation: SOURCES.impactReport.participantCollection
      ? ""
      : "El esquema actual del Informe de Impacto no guarda una colección de participantes. La presencia individual deberá añadirse o confirmarse en el bloque de trazabilidad."
  };
}

module.exports = {
  REPORTING_SCHEMA_VERSION,
  DOCUMENTS_COLLECTION,
  REPORT_RUNS_COLLECTION,
  SOURCES,
  PERSON_SOURCE_KEYS,
  COURSE_SOURCE_KEYS,
  INDIVIDUAL_EVIDENCE_KEYS,
  listSourceKeys,
  listCollections,
  getSource,
  getSourceByDocumentType,
  getReportingCapabilities
};
