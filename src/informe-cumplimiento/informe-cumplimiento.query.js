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

function text(value) { return String(value == null ? "" : value).trim(); }
function normalizePeriod(value) {
  const clean = text(value);
  const match = clean.match(/((?:19|20)\d{2})[-\/_\s](0?[1-9]|1[0-2])/);
  return match ? `${match[1]}-${String(Number(match[2])).padStart(2, "0")}` : clean;
}
function documentMap(documents) {
  return new Map((documents || []).map((document) => [text(document.id_documento || document.id), document]).filter(([id]) => id));
}
function enrichRow(row, documentsById) {
  const source = row && typeof row === "object" ? { ...row } : {};
  const document = documentsById.get(text(source.id_documento)) || {};
  const periodo = normalizePeriod(source.periodo || document.periodo);
  return {
    ...source,
    periodo,
    anio_periodo: text(source.anio_periodo || document.anio_periodo) || (periodo.match(/^\d{4}-\d{2}$/) ? periodo.slice(0, 4) : ""),
    mes_periodo: text(source.mes_periodo || document.mes_periodo) || (periodo.match(/^\d{4}-\d{2}$/) ? periodo.slice(5, 7) : "")
  };
}

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
    const raw = Object.fromEntries(Object.entries(COLLECTIONS).map(([key, name]) => [key, this.readSafe(name)]));
    const documentsById = documentMap(raw.documents);
    return Object.fromEntries(Object.entries(raw).map(([key, rows]) => {
      if (["documents", "runs"].includes(key)) return [key, rows];
      return [key, (rows || []).map((row) => enrichRow(row, documentsById))];
    }));
  }
}

function createComplianceReportQuery(database) {
  return new ComplianceReportQuery(database);
}

module.exports = {
  COLLECTIONS,
  ComplianceReportQuery,
  createComplianceReportQuery,
  normalizePeriod,
  documentMap,
  enrichRow
};