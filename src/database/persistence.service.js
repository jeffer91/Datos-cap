/* =========================================================
Nombre completo: persistence.service.js
Ruta o ubicación: /src/database/persistence.service.js
Función o funciones:
- Guardar documentos procesados y sus tablas en la base local.
- Evitar duplicados mediante huella SHA-256.
- Conservar método de extracción, páginas OCR y confianza.
- Propagar periodo, año y mes a todas las filas relacionadas.
- Reparar automáticamente registros antiguos sin periodo.
- Registrar ejecuciones para la página Base.
========================================================= */
"use strict";

const crypto = require("crypto");
const path = require("path");
const { LocalDatabase, nowIso } = require("./local-database");
const { calculateFileHash } = require("../utils/hash.utils");
const { extractPeriodoFromCodigo } = require("../utils/ids");

const DOCUMENTS_COLLECTION = "_documents";
const RUNS_COLLECTION = "_processing_runs";
const TYPE_LABELS = Object.freeze({
  "plan-individual": "Plan Individual de Formación y Capacitación Docente",
  "acuerdo-patrocinio": "Acuerdo de Patrocinio Institucional",
  "planificacion-capacitacion": "Planificación de Capacitación",
  "informe-final-capacitacion": "Informe Final de Capacitación",
  "instrumento-evaluacion": "Instrumento de Evaluación",
  "informe-impacto": "Informe de Impacto"
});

function makeId(prefix) {
  if (typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${crypto.createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex")}`;
}
function text(value) { return String(value == null ? "" : value).trim(); }
function getTypeLabel(documentType) { return TYPE_LABELS[documentType] || documentType || "Documento"; }

function normalizePeriod(value) {
  const clean = text(value);
  const match = clean.match(/((?:19|20)\d{2})[-\/_\s](0?[1-9]|1[0-2])/);
  if (!match) return clean;
  return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
}

function periodMetadata(value) {
  const periodo = normalizePeriod(value);
  const match = periodo.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/);
  return {
    periodo,
    anio_periodo: match ? match[1] : "",
    mes_periodo: match ? match[2] : ""
  };
}

function getFileData(parsed) {
  const document = parsed || {};
  const file = document.archivo || {};
  const general = document.identificacion || document.datos_acuerdo || document.datos_generales || {};
  const filePath = text(file.ruta_archivo);
  const source = document.source || {};
  const codigoDocumento = text(file.codigo_documento || general.codigo_documento);
  const period = periodMetadata(file.periodo || general.periodo || extractPeriodoFromCodigo(codigoDocumento));
  return {
    id_documento: text(document.id_documento || file.id_documento),
    nombre_archivo: text(file.nombre_archivo || path.basename(filePath)),
    ruta_archivo: filePath,
    hash_archivo: text(file.hash_archivo || source.file_hash) || calculateFileHash(filePath),
    codigo_original: text(file.codigo_original || general.codigo_original),
    codigo_documento: codigoDocumento,
    periodo: period.periodo,
    anio_periodo: text(file.anio_periodo || general.anio_periodo) || period.anio_periodo,
    mes_periodo: text(file.mes_periodo || general.mes_periodo) || period.mes_periodo,
    docente: text(general.nombre_docente || general.docente || general.evaluador),
    carrera: text(general.carrera || general.carrera_publico || general.publico_dirigido),
    publico_dirigido: text(general.publico_dirigido || general.carrera_publico),
    capacitacion: text(general.capacitacion_final || general.nombre_capacitacion || general.capacitacion || general.nombre_curso),
    facilitador: text(general.facilitador),
    total_participantes: Number(general.total_participantes_detectados || general.total_participantes || 0),
    metodo_extraccion: text(file.metodo_extraccion || source.extraction_method || "digital"),
    total_paginas: Number(file.total_paginas || file.paginas_fisicas || 0),
    paginas_declaradas: Number(file.paginas_declaradas || general.paginas_declaradas || 0),
    coinciden_paginas: text(file.coinciden_paginas || "NO_VERIFICABLE"),
    paginas_digitales: Number(file.paginas_digitales || source.digital_pages || 0),
    paginas_ocr: Number(file.paginas_ocr || source.ocr_pages || 0),
    confianza_ocr: Number(file.confianza_ocr || source.ocr_confidence || 0),
    estado_extraccion: text(file.estado_extraccion || "OK"),
    requiere_revision: text(file.requiere_revision || general.requiere_revision || "NO")
  };
}

function documentIndex(documents) {
  return new Map((documents || []).map((document) => [
    text(document.id_documento || document.id),
    document
  ]).filter(([id]) => id));
}

function enrichRowWithDocumentPeriod(row, documentsById) {
  const source = row && typeof row === "object" ? { ...row } : row;
  if (!source || typeof source !== "object") return source;
  const documentId = text(source.id_documento);
  if (!documentId) return source;
  const document = documentsById.get(documentId) || {};
  const period = periodMetadata(source.periodo || document.periodo || extractPeriodoFromCodigo(source.codigo_documento || document.codigo_documento));
  return {
    ...source,
    periodo: period.periodo,
    anio_periodo: text(source.anio_periodo) || text(document.anio_periodo) || period.anio_periodo,
    mes_periodo: text(source.mes_periodo) || text(document.mes_periodo) || period.mes_periodo
  };
}

function rowsDiffer(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

class PersistenceService {
  constructor(databaseDirectory) {
    this.database = new LocalDatabase(databaseDirectory);
    this.database.initialize();
    this.lastPeriodBackfill = this.backfillPeriodMetadata();
  }

  getDatabasePath() { return this.database.rootDirectory; }
  getSummary() { return this.database.getSummary(); }

  backfillPeriodMetadata() {
    const documents = this.database.readCollection(DOCUMENTS_COLLECTION);
    if (!documents.length) return { collectionsUpdated: 0, rowsUpdated: 0 };
    const documentsById = documentIndex(documents);
    let collectionsUpdated = 0;
    let rowsUpdated = 0;

    this.database.listCollections()
      .filter((collection) => !collection.startsWith("_"))
      .forEach((collection) => {
        const rows = this.database.readCollection(collection);
        let changed = false;
        const enriched = rows.map((row) => {
          const next = enrichRowWithDocumentPeriod(row, documentsById);
          if (rowsDiffer(row, next)) {
            changed = true;
            rowsUpdated += 1;
          }
          return next;
        });
        if (changed) {
          this.database.replaceCollection(collection, enriched);
          collectionsUpdated += 1;
        }
      });

    return { collectionsUpdated, rowsUpdated };
  }

  persistProcessingResult(options = {}) {
    const documentType = text(options.documentType);
    const parsedDocuments = Array.isArray(options.parsedDocuments) ? options.parsedDocuments : [];
    const tables = options.tables && typeof options.tables === "object" ? options.tables : {};
    const documents = this.database.readCollection(DOCUMENTS_COLLECTION);
    const acceptedIds = new Set();
    const duplicates = [];
    const inserted = [];
    const timestamp = nowIso();
    const runId = makeId("run");

    parsedDocuments.forEach((parsed) => {
      const metadata = getFileData(parsed);
      if (!metadata.id_documento) return;
      const duplicate = metadata.hash_archivo
        ? documents.find((row) => row.tipo_documental === documentType && row.hash_archivo === metadata.hash_archivo)
        : null;
      if (duplicate) {
        duplicates.push({
          id_documento_existente: duplicate.id_documento,
          id_documento_nuevo: metadata.id_documento,
          nombre_archivo: metadata.nombre_archivo
        });
        return;
      }

      const record = {
        id: metadata.id_documento,
        ...metadata,
        tipo_documental: documentType,
        nombre_tipo_documental: getTypeLabel(documentType),
        fecha_registro: timestamp,
        ultima_fecha_procesamiento: timestamp,
        ejecucion_origen_id: runId
      };
      documents.push(record);
      inserted.push(record);
      acceptedIds.add(metadata.id_documento);
    });

    this.database.replaceCollection(DOCUMENTS_COLLECTION, documents);
    const documentsById = documentIndex(documents);
    let rowsSaved = 0;
    const tableResults = {};
    Object.entries(tables).forEach(([collection, rows]) => {
      const filtered = (Array.isArray(rows) ? rows : [])
        .filter((row) => {
          const documentId = text(row && row.id_documento);
          return documentId && acceptedIds.has(documentId);
        })
        .map((row) => enrichRowWithDocumentPeriod(row, documentsById));
      const result = this.database.upsertMany(collection, filtered, "id");
      rowsSaved += result.inserted + result.updated;
      tableResults[collection] = result;
    });

    const periodCounts = inserted.reduce((counts, row) => {
      const key = text(row.periodo) || "SIN_PERIODO";
      counts[key] = Number(counts[key] || 0) + 1;
      return counts;
    }, {});
    const run = {
      id: runId,
      tipo_documental: documentType,
      nombre_tipo_documental: getTypeLabel(documentType),
      fecha_inicio: timestamp,
      fecha_fin: timestamp,
      estado: "GUARDADO_LOCALMENTE",
      documentos_recibidos: parsedDocuments.length,
      documentos_guardados: inserted.length,
      documentos_duplicados_omitidos: duplicates.length,
      filas_guardadas: rowsSaved,
      periodos_detectados: Object.keys(periodCounts).filter((period) => period !== "SIN_PERIODO"),
      documentos_por_periodo: periodCounts,
      paginas_ocr: inserted.reduce((sum, row) => sum + Number(row.paginas_ocr || 0), 0),
      carpeta_salida: text(options.outputDir),
      archivos_exportados: {},
      resumen: options.summary || {},
      mensaje_error: ""
    };
    this.database.upsertMany(RUNS_COLLECTION, [run], "id");

    return {
      ok: true,
      runId,
      databasePath: this.getDatabasePath(),
      documentsSaved: inserted.length,
      duplicateDocumentsSkipped: duplicates.length,
      rowsSaved,
      periodsSaved: periodCounts,
      ocrPagesSaved: run.paginas_ocr,
      duplicates,
      tableResults
    };
  }

  completeRun(runId, result = {}) {
    const runs = this.database.readCollection(RUNS_COLLECTION);
    const index = runs.findIndex((row) => row.id === runId);
    if (index < 0) return { ok: false, message: "No se encontró la ejecución local." };
    runs[index] = {
      ...runs[index],
      fecha_fin: nowIso(),
      estado: result.ok === false ? "GUARDADO_SIN_EXPORTAR" : "COMPLETADO",
      archivos_exportados: result.files || {},
      mensaje_error: text(result.message)
    };
    this.database.replaceCollection(RUNS_COLLECTION, runs);
    return { ok: true };
  }

  listRecentRuns(limit = 10) {
    return this.database.readCollection(RUNS_COLLECTION)
      .sort((a, b) => String(b.fecha_fin || b.fecha_inicio).localeCompare(String(a.fecha_fin || a.fecha_inicio)))
      .slice(0, Math.max(1, Math.min(Number(limit) || 10, 100)));
  }

  listRecentDocuments(limit = 20) {
    return this.database.readCollection(DOCUMENTS_COLLECTION)
      .sort((a, b) => String(b.fecha_registro || "").localeCompare(String(a.fecha_registro || "")))
      .slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)));
  }
}

function createPersistenceService(databaseDirectory) { return new PersistenceService(databaseDirectory); }

module.exports = {
  DOCUMENTS_COLLECTION,
  RUNS_COLLECTION,
  TYPE_LABELS,
  PersistenceService,
  createPersistenceService,
  getTypeLabel,
  getFileData,
  normalizePeriod,
  periodMetadata,
  documentIndex,
  enrichRowWithDocumentPeriod
};