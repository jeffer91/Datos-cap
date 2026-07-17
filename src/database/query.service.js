/* =========================================================
Nombre completo: query.service.js
Ruta o ubicación: /src/database/query.service.js
Función o funciones:
- Consultar la base local para la página independiente Base.
- Entregar resumen, documentos, registros por tipo, detalles y procesamientos.
- Enriquecer registros antiguos con el periodo de su documento padre.
- Filtrar documentos y tablas por periodo académico.
========================================================= */
"use strict";

const TYPE_COLLECTIONS = Object.freeze({
  "plan-individual": "identificacion_docente",
  "acuerdo-patrocinio": "datos_acuerdo_patrocinio",
  "planificacion-capacitacion": "datos_planificacion_capacitacion",
  "informe-final-capacitacion": "datos_generales_informe",
  "instrumento-evaluacion": "datos_generales_instrumento",
  "informe-impacto": "datos_generales_informe_impacto"
});

const TYPE_DETAIL_COLLECTIONS = Object.freeze({
  "plan-individual": [
    "archivos_plan_individual",
    "identificacion_docente",
    "capacidades_docente",
    "capacitaciones_propuestas",
    "formacion_docente"
  ],
  "acuerdo-patrocinio": [
    "archivos_acuerdo_patrocinio",
    "datos_acuerdo_patrocinio",
    "apoyos_acuerdo_patrocinio",
    "responsables_acuerdo_patrocinio"
  ],
  "planificacion-capacitacion": [
    "archivos_planificacion_capacitacion",
    "datos_planificacion_capacitacion",
    "temario_planificacion_capacitacion",
    "evaluaciones_planificacion_capacitacion",
    "responsables_planificacion_capacitacion",
    "facilitadores_planificacion_capacitacion",
    "anexos_planificacion_capacitacion",
    "ocr_paginas_planificacion"
  ],
  "informe-final-capacitacion": [
    "archivos_informe_final",
    "datos_generales_informe",
    "objetivos_informe",
    "participantes_informe",
    "certificados_informe",
    "resumen_certificados_informe",
    "responsables_informe",
    "anexos_informe",
    "ocr_paginas_informe"
  ],
  "instrumento-evaluacion": [
    "archivos_instrumento_evaluacion",
    "datos_generales_instrumento",
    "items_instrumento_evaluacion",
    "resultados_instrumento_evaluacion",
    "responsables_instrumento_evaluacion",
    "anexos_instrumento_evaluacion",
    "ocr_paginas_instrumento_evaluacion"
  ],
  "informe-impacto": [
    "archivos_informe_impacto",
    "datos_generales_informe_impacto",
    "indicadores_informe_impacto",
    "resultados_informe_impacto",
    "recomendaciones_informe_impacto",
    "participantes_informe_impacto",
    "responsables_informe_impacto",
    "anexos_informe_impacto",
    "ocr_paginas_informe_impacto"
  ]
});

function text(value) { return String(value == null ? "" : value).trim(); }
function limitValue(value, fallback = 100) {
  return Math.max(1, Math.min(Number(value) || fallback, 1000));
}
function includesQuery(record, query) {
  const normalized = text(query).toLowerCase();
  if (!normalized) return true;
  return Object.values(record || {}).some((value) => text(value).toLowerCase().includes(normalized));
}
function normalizePeriod(value) {
  const clean = text(value);
  const match = clean.match(/((?:19|20)\d{2})[-\/_\s](0?[1-9]|1[0-2])/);
  return match ? `${match[1]}-${String(Number(match[2])).padStart(2, "0")}` : clean;
}
function documentMap(documents) {
  return new Map((documents || []).map((document) => [text(document.id_documento || document.id), document]).filter(([id]) => id));
}
function enrichWithDocument(record, documentsById) {
  const row = record && typeof record === "object" ? { ...record } : {};
  const document = documentsById.get(text(row.id_documento)) || {};
  const periodo = normalizePeriod(row.periodo || document.periodo);
  return {
    ...row,
    periodo,
    anio_periodo: text(row.anio_periodo || document.anio_periodo) || (periodo.match(/^\d{4}-\d{2}$/) ? periodo.slice(0, 4) : ""),
    mes_periodo: text(row.mes_periodo || document.mes_periodo) || (periodo.match(/^\d{4}-\d{2}$/) ? periodo.slice(5, 7) : "")
  };
}

class QueryService {
  constructor(database) {
    if (!database) throw new Error("QueryService requiere una instancia de base local.");
    this.database = database;
  }

  readSafe(collection) {
    try { return this.database.readCollection(collection); }
    catch (_error) { return []; }
  }

  getSummary() {
    const base = this.database.getSummary();
    const documents = this.readSafe("_documents");
    const runs = this.readSafe("_processing_runs");
    const documentsByPeriod = documents.reduce((counts, row) => {
      const periodo = normalizePeriod(row.periodo) || "SIN_PERIODO";
      counts[periodo] = Number(counts[periodo] || 0) + 1;
      return counts;
    }, {});
    const periods = Object.keys(documentsByPeriod)
      .filter((periodo) => periodo !== "SIN_PERIODO")
      .sort((a, b) => b.localeCompare(a));
    return {
      ...base,
      planCount: documents.filter((row) => row.tipo_documental === "plan-individual").length,
      agreementCount: documents.filter((row) => row.tipo_documental === "acuerdo-patrocinio").length,
      planningCount: documents.filter((row) => row.tipo_documental === "planificacion-capacitacion").length,
      finalReportCount: documents.filter((row) => row.tipo_documental === "informe-final-capacitacion").length,
      evaluationInstrumentCount: documents.filter((row) => row.tipo_documental === "instrumento-evaluacion").length,
      impactReportCount: documents.filter((row) => row.tipo_documental === "informe-impacto").length,
      reviewCount: documents.filter((row) => row.requiere_revision === "SI").length,
      digitalDocumentCount: documents.filter((row) => row.metodo_extraccion === "digital").length,
      ocrDocumentCount: documents.filter((row) => row.metodo_extraccion === "ocr").length,
      mixedDocumentCount: documents.filter((row) => row.metodo_extraccion === "mixed").length,
      ocrPageCount: documents.reduce((sum, row) => sum + Number(row.paginas_ocr || 0), 0),
      averageOcrConfidence: (() => {
        const values = documents.map((row) => Number(row.confianza_ocr || 0)).filter((value) => value > 0);
        return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
      })(),
      duplicateCount: runs.reduce((sum, row) => sum + Number(row.documentos_duplicados_omitidos || 0), 0),
      periods,
      documentsByPeriod,
      documentsWithoutPeriod: Number(documentsByPeriod.SIN_PERIODO || 0)
    };
  }

  listDocuments(options = {}) {
    const limit = limitValue(options.limit, 200);
    const requestedPeriod = normalizePeriod(options.period);
    return this.readSafe("_documents")
      .filter((row) => !options.documentType || row.tipo_documental === options.documentType)
      .filter((row) => !requestedPeriod || normalizePeriod(row.periodo) === requestedPeriod)
      .filter((row) => !options.reviewOnly || row.requiere_revision === "SI")
      .filter((row) => includesQuery(row, options.query))
      .sort((a, b) => text(b.fecha_registro).localeCompare(text(a.fecha_registro)))
      .slice(0, limit);
  }

  listProcessingRuns(options = {}) {
    const limit = limitValue(options.limit, 100);
    return this.readSafe("_processing_runs")
      .filter((row) => !options.documentType || row.tipo_documental === options.documentType)
      .filter((row) => !options.period || (row.periodos_detectados || []).includes(normalizePeriod(options.period)))
      .filter((row) => includesQuery(row, options.query))
      .sort((a, b) => text(b.fecha_fin || b.fecha_inicio).localeCompare(text(a.fecha_fin || a.fecha_inicio)))
      .slice(0, limit);
  }

  listTypeRecords(documentType, options = {}) {
    const collection = TYPE_COLLECTIONS[documentType];
    if (!collection) throw new Error(`Tipo documental no consultable: ${documentType || "vacío"}.`);
    const limit = limitValue(options.limit, 300);
    const documents = this.readSafe("_documents");
    const documentsById = documentMap(documents);
    const requestedPeriod = normalizePeriod(options.period);
    return {
      documentType,
      collection,
      records: this.readSafe(collection)
        .map((row) => enrichWithDocument(row, documentsById))
        .filter((row) => !requestedPeriod || normalizePeriod(row.periodo) === requestedPeriod)
        .filter((row) => includesQuery(row, options.query))
        .slice(0, limit)
    };
  }

  getDocumentDetails(documentId) {
    const id = text(documentId);
    if (!id) throw new Error("Debes indicar el documento que deseas consultar.");
    const documents = this.readSafe("_documents");
    const document = documents.find((row) => text(row.id_documento || row.id) === id);
    if (!document) throw new Error("El documento no existe en la base local.");
    const documentsById = documentMap(documents);
    const collections = {};
    (TYPE_DETAIL_COLLECTIONS[document.tipo_documental] || []).forEach((collection) => {
      collections[collection] = this.readSafe(collection)
        .filter((row) => text(row.id_documento) === id)
        .map((row) => enrichWithDocument(row, documentsById));
    });
    return { document, collections };
  }

  getOverview(options = {}) {
    return {
      ok: true,
      summary: this.getSummary(),
      documents: this.listDocuments({ limit: options.documentLimit || 20 }),
      runs: this.listProcessingRuns({ limit: options.runLimit || 10 })
    };
  }
}

function createQueryService(database) { return new QueryService(database); }

module.exports = {
  TYPE_COLLECTIONS,
  TYPE_DETAIL_COLLECTIONS,
  QueryService,
  createQueryService,
  normalizePeriod,
  documentMap,
  enrichWithDocument
};