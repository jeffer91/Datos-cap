/* =========================================================
Nombre completo: persistence.service.js
Ruta o ubicación: /src/database/persistence.service.js
Función o funciones:
- Guardar documentos procesados y sus tablas en la base local.
- Evitar duplicados mediante huella SHA-256.
- Conservar método de extracción, páginas OCR y confianza.
- Registrar ejecuciones para la página Base.
========================================================= */
"use strict";

const crypto = require("crypto");
const path = require("path");
const { LocalDatabase, nowIso } = require("./local-database");
const { calculateFileHash } = require("../utils/hash.utils");

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

function getFileData(parsed) {
  const document = parsed || {};
  const file = document.archivo || {};
  const general = document.identificacion || document.datos_acuerdo || document.datos_generales || {};
  const filePath = text(file.ruta_archivo);
  const source = document.source || {};
  return {
    id_documento: text(document.id_documento || file.id_documento),
    nombre_archivo: text(file.nombre_archivo || path.basename(filePath)),
    ruta_archivo: filePath,
    hash_archivo: text(file.hash_archivo || source.file_hash) || calculateFileHash(filePath),
    codigo_original: text(file.codigo_original || general.codigo_original),
    codigo_documento: text(file.codigo_documento || general.codigo_documento),
    periodo: text(file.periodo || general.periodo),
    docente: text(general.nombre_docente || general.docente || general.evaluador),
    carrera: text(general.carrera || general.carrera_publico || general.publico_dirigido),
    publico_dirigido: text(general.publico_dirigido || general.carrera_publico),
    capacitacion: text(general.nombre_capacitacion || general.capacitacion || general.nombre_curso),
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

class PersistenceService {
  constructor(databaseDirectory) {
    this.database = new LocalDatabase(databaseDirectory);
    this.database.initialize();
  }

  getDatabasePath() { return this.database.rootDirectory; }
  getSummary() { return this.database.getSummary(); }

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
    let rowsSaved = 0;
    const tableResults = {};
    Object.entries(tables).forEach(([collection, rows]) => {
      const filtered = (Array.isArray(rows) ? rows : []).filter((row) => {
        const documentId = text(row && row.id_documento);
        return documentId && acceptedIds.has(documentId);
      });
      const result = this.database.upsertMany(collection, filtered, "id");
      rowsSaved += result.inserted + result.updated;
      tableResults[collection] = result;
    });

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
  getFileData
};
