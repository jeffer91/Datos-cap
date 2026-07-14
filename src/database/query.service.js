/* =========================================================
Nombre completo: query.service.js
Ruta o ubicación: /src/database/query.service.js
Función o funciones:
- Consultar la base local para la página independiente Base.
- Entregar resumen, documentos, registros por tipo y procesamientos.
========================================================= */
"use strict";

const TYPE_COLLECTIONS = Object.freeze({
  "plan-individual": "identificacion_docente",
  "acuerdo-patrocinio": "datos_acuerdo_patrocinio",
  "planificacion-capacitacion": "datos_planificacion_capacitacion"
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
    return {
      ...base,
      planCount: documents.filter((row) => row.tipo_documental === "plan-individual").length,
      agreementCount: documents.filter((row) => row.tipo_documental === "acuerdo-patrocinio").length,
      planningCount: documents.filter((row) => row.tipo_documental === "planificacion-capacitacion").length,
      reviewCount: documents.filter((row) => row.requiere_revision === "SI").length,
      digitalDocumentCount: documents.filter((row) => row.metodo_extraccion === "digital").length,
      ocrDocumentCount: documents.filter((row) => row.metodo_extraccion === "ocr").length,
      mixedDocumentCount: documents.filter((row) => row.metodo_extraccion === "mixed").length,
      ocrPageCount: documents.reduce((sum, row) => sum + Number(row.paginas_ocr || 0), 0),
      averageOcrConfidence: (() => {
        const values = documents.map((row) => Number(row.confianza_ocr || 0)).filter((value) => value > 0);
        return values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : 0;
      })(),
      duplicateCount: runs.reduce((sum, row) => sum + Number(row.documentos_duplicados_omitidos || 0), 0)
    };
  }

  listDocuments(options = {}) {
    const limit = limitValue(options.limit, 200);
    return this.readSafe("_documents")
      .filter((row) => !options.documentType || row.tipo_documental === options.documentType)
      .filter((row) => !options.reviewOnly || row.requiere_revision === "SI")
      .filter((row) => includesQuery(row, options.query))
      .sort((a, b) => text(b.fecha_registro).localeCompare(text(a.fecha_registro)))
      .slice(0, limit);
  }

  listProcessingRuns(options = {}) {
    const limit = limitValue(options.limit, 100);
    return this.readSafe("_processing_runs")
      .filter((row) => !options.documentType || row.tipo_documental === options.documentType)
      .filter((row) => includesQuery(row, options.query))
      .sort((a, b) => text(b.fecha_fin || b.fecha_inicio).localeCompare(text(a.fecha_fin || a.fecha_inicio)))
      .slice(0, limit);
  }

  listTypeRecords(documentType, options = {}) {
    const collection = TYPE_COLLECTIONS[documentType];
    if (!collection) throw new Error(`Tipo documental no consultable: ${documentType || "vacío"}.`);
    const limit = limitValue(options.limit, 300);
    return {
      documentType,
      collection,
      records: this.readSafe(collection)
        .filter((row) => !options.period || text(row.periodo) === text(options.period))
        .filter((row) => includesQuery(row, options.query))
        .slice(0, limit)
    };
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
  QueryService,
  createQueryService
};
