"use strict";

const COLLECTIONS = Object.freeze({
  documents: "_documents",
  runs: "_processing_runs",
  teachers: "identificacion_docente",
  proposedTrainings: "capacitaciones_propuestas",
  agreements: "datos_acuerdo_patrocinio",
  plannings: "datos_planificacion_capacitacion",
  planningEvaluations: "evaluaciones_planificacion_capacitacion",
  finalReports: "datos_generales_informe",
  finalObjectives: "objetivos_informe",
  finalParticipants: "participantes_informe",
  instruments: "datos_generales_instrumento",
  instrumentResults: "resultados_instrumento_evaluacion",
  instrumentParticipants: "participantes_instrumento_evaluacion",
  impacts: "datos_generales_informe_impacto",
  impactIndicators: "indicadores_informe_impacto",
  impactParticipants: "participantes_informe_impacto"
});

class ComplianceReportQuery {
  constructor(database) {
    if (!database) throw new Error("El Informe de Cumplimiento requiere una base local.");
    this.database = database;
  }

  readSafe(collection) {
    try {
      const rows = this.database.readCollection(collection);
      return Array.isArray(rows) ? rows : [];
    } catch (_error) {
      return [];
    }
  }

  load() {
    return Object.fromEntries(Object.entries(COLLECTIONS).map(([key, name]) => [key, this.readSafe(name)]));
  }
}

function createComplianceReportQuery(database) {
  return new ComplianceReportQuery(database);
}

module.exports = { COLLECTIONS, ComplianceReportQuery, createComplianceReportQuery };
