/* =========================================================
Nombre completo: persistence.service.js
Ruta o ubicación: /src/database/persistence.service.js
Función o funciones:
- Persistir documentos procesados y todas sus tablas en la base local.
- Evitar duplicados por huella digital en documentos repetitivos.
- Versionar documentos únicos por tipo y periodo sin borrar el historial.
- Registrar cada ejecución, exportación y resumen del procesamiento.
========================================================= */

"use strict";

const crypto = require("crypto");
const path = require("path");
const { LocalDatabase, nowIso } = require("./local-database");

const DOCUMENTS_COLLECTION = "_documents";
const RUNS_COLLECTION = "_processing_runs";

function createRunId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return crypto.createHash("sha256").update(`${Date.now()}-${Math.random()}`).digest("hex").slice(0, 32);
}

function normalizeText(value) {
  return String(value === null || typeof value === "undefined" ? "" : value).trim();
}

function firstNonEmpty(...values) {
  return values.map(normalizeText).find(Boolean) || "";
}

function getParsedDocumentMetadata(parsedDocument, definition) {
  const document = parsedDocument || {};
  const file = document.archivo || {};
  const general = document.datos_generales || document.identificacion || {};

  return {
    id_documento: firstNonEmpty(document.id_documento, file.id_documento),
    tipo_documental: firstNonEmpty(document.document_type, definition && definition.id),
    nombre_tipo_documental: firstNonEmpty(definition && definition.label),
    codigo_documento: firstNonEmpty(file.codigo_documento, general.codigo_documento),
    periodo: firstNonEmpty(file.periodo, general.periodo),
    nombre_archivo: firstNonEmpty(file.nombre_archivo),
    ruta_archivo: firstNonEmpty(file.ruta_archivo),
    hash_archivo: firstNonEmpty(file.hash_archivo, document.source && document.source.file_hash),
    estado_extraccion: firstNonEmpty(file.estado_extraccion, "OK"),
    requiere_revision: firstNonEmpty(file.requiere_revision, "NO")
  };
}

function calculateNextVersion(documents, documentType, period) {
  const versions = documents
    .filter((record) => record.tipo_documental === documentType && record.periodo === period)
    .map((record) => Number(record.version_local || 0))
    .filter((value) => Number.isFinite(value));
  return versions.length ? Math.max(...versions) + 1 : 1;
}

function prepareDocumentPersistence(existingDocuments, parsedDocuments, definition, runId) {
  const documents = Array.isArray(existingDocuments) ? existingDocuments.map((record) => ({ ...record })) : [];
  const parsed = Array.isArray(parsedDocuments) ? parsedDocuments : [];
  const acceptedIds = new Set();
  const skippedIds = new Set();
  const insertedDocuments = [];
  const duplicateDocuments = [];
  const versionChanges = [];
  const timestamp = nowIso();

  parsed.forEach((parsedDocument) => {
    const metadata = getParsedDocumentMetadata(parsedDocument, definition);
    if (!metadata.id_documento) return;

    const duplicate = metadata.hash_archivo
      ? documents.find((record) =>
        record.tipo_documental === metadata.tipo_documental &&
        record.hash_archivo === metadata.hash_archivo
      )
      : null;

    if (duplicate) {
      duplicate.ultima_ejecucion_id = runId;
      duplicate.ultima_fecha_procesamiento = timestamp;
      duplicateDocuments.push({
        id_documento_nuevo: metadata.id_documento,
        id_documento_existente: duplicate.id_documento,
        nombre_archivo: metadata.nombre_archivo,
        hash_archivo: metadata.hash_archivo
      });
      skippedIds.add(metadata.id_documento);
      return;
    }

    let localVersion = 1;
    if (definition && definition.uniquePerPeriod && metadata.periodo) {
      localVersion = calculateNextVersion(documents, metadata.tipo_documental, metadata.periodo);

      documents.forEach((record) => {
        if (
          record.tipo_documental === metadata.tipo_documental &&
          record.periodo === metadata.periodo &&
          record.activo !== false &&
          record.estado_version !== "SUPERADO"
        ) {
          record.activo = false;
          record.estado_version = "SUPERADO";
          record.superado_por = metadata.id_documento;
          record.fecha_superado = timestamp;
          versionChanges.push({
            id_documento: record.id_documento,
            superado_por: metadata.id_documento,
            periodo: metadata.periodo
          });
        }
      });
    }

    const record = {
      id: metadata.id_documento,
      ...metadata,
      documento_unico_periodo: Boolean(definition && definition.uniquePerPeriod),
      version_local: localVersion,
      activo: true,
      estado_version: localVersion > 1 ? "VERSION_ACTIVA" : "ACTIVO",
      ejecucion_origen_id: runId,
      ultima_ejecucion_id: runId,
      fecha_registro: timestamp,
      ultima_fecha_procesamiento: timestamp
    };

    documents.push(record);
    insertedDocuments.push(record);
    acceptedIds.add(metadata.id_documento);
  });

  return {
    documents,
    acceptedIds,
    skippedIds,
    insertedDocuments,
    duplicateDocuments,
    versionChanges
  };
}

function filterTableRows(tables, acceptedIds) {
  const source = tables && typeof tables === "object" ? tables : {};
  const output = {};

  Object.entries(source).forEach(([collection, rows]) => {
    const list = Array.isArray(rows) ? rows : [];
    output[collection] = list.filter((row) => {
      const documentId = normalizeText(row && row.id_documento);
      return !documentId || acceptedIds.has(documentId);
    });
  });

  return output;
}

class PersistenceService {
  constructor(databaseDirectory) {
    this.database = new LocalDatabase(databaseDirectory);
  }

  initialize() {
    return this.database.initialize();
  }

  getDatabasePath() {
    return this.database.rootDirectory;
  }

  getSummary() {
    return this.database.getSummary();
  }

  listRecentRuns(options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 10), 100));
    const documentType = normalizeText(options.documentType);
    return this.database
      .readCollection(RUNS_COLLECTION)
      .filter((record) => !documentType || record.tipo_documental === documentType)
      .sort((a, b) => String(b.fecha_inicio || "").localeCompare(String(a.fecha_inicio || "")))
      .slice(0, limit);
  }

  enrichValidation(validation, documentType) {
    const result = validation && typeof validation === "object" ? validation : {};
    const existing = this.database.readCollection(DOCUMENTS_COLLECTION);
    let localDuplicateCount = 0;

    (result.files || []).forEach((file) => {
      const match = file.fileHash
        ? existing.find((record) => record.tipo_documental === documentType && record.hash_archivo === file.fileHash)
        : null;

      file.localDuplicate = Boolean(match);
      file.localDocumentId = match ? match.id_documento : "";
      file.localVersion = match ? match.version_local : "";

      if (match) {
        localDuplicateCount += 1;
        file.warnings = Array.isArray(file.warnings) ? file.warnings : [];
        file.warnings.push("El contenido de este PDF ya existe en la base local. Puede reprocesarse para exportar, pero no se duplicarán sus registros.");
      }
    });

    result.localDuplicateCount = localDuplicateCount;
    return result;
  }

  persistProcessingResult(options) {
    const config = options || {};
    const definition = config.definition || {};
    const parseResult = config.parseResult || {};
    const tableResult = config.tableResult || {};
    const runId = createRunId();
    const startedAt = config.startedAt || nowIso();
    const existingDocuments = this.database.readCollection(DOCUMENTS_COLLECTION);
    const prepared = prepareDocumentPersistence(
      existingDocuments,
      parseResult.parsed,
      definition,
      runId
    );
    const filteredTables = filterTableRows(tableResult.tables, prepared.acceptedIds);
    const operations = [
      {
        collection: DOCUMENTS_COLLECTION,
        mode: "replace",
        records: prepared.documents
      }
    ];

    Object.entries(filteredTables).forEach(([collection, rows]) => {
      operations.push({ collection, mode: "upsert", keyField: "id", records: rows });
    });

    const runRecord = {
      id: runId,
      tipo_documental: definition.id || config.documentType || "",
      nombre_tipo_documental: definition.label || "",
      procesador_documental: config.processorId || definition.processorId || definition.id || "",
      fecha_inicio: startedAt,
      fecha_fin: "",
      estado: "PROCESADO_LOCALMENTE",
      documentos_recibidos: Array.isArray(parseResult.parsed) ? parseResult.parsed.length : 0,
      documentos_guardados: prepared.insertedDocuments.length,
      documentos_duplicados_omitidos: prepared.duplicateDocuments.length,
      versiones_superadas: prepared.versionChanges.length,
      filas_recibidas: Object.values(tableResult.tables || {}).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0),
      filas_guardadas: Object.values(filteredTables).reduce((sum, rows) => sum + rows.length, 0),
      resumen: tableResult.summary || {},
      archivos_exportados: {},
      carpeta_salida: normalizeText(config.outputDir),
      mensaje_error: ""
    };

    operations.push({
      collection: RUNS_COLLECTION,
      mode: "upsert",
      keyField: "id",
      records: [runRecord]
    });

    const transaction = this.database.applyTransaction(operations);

    return {
      ok: true,
      runId,
      databasePath: this.getDatabasePath(),
      acceptedDocumentIds: [...prepared.acceptedIds],
      documentsSaved: prepared.insertedDocuments.length,
      duplicateDocumentsSkipped: prepared.duplicateDocuments.length,
      supersededVersions: prepared.versionChanges.length,
      rowsSaved: runRecord.filas_guardadas,
      duplicateDocuments: prepared.duplicateDocuments,
      versionChanges: prepared.versionChanges,
      transaction,
      summary: this.getSummary()
    };
  }

  finalizeProcessingRun(runId, options = {}) {
    const runs = this.database.readCollection(RUNS_COLLECTION);
    const index = runs.findIndex((record) => record.id === runId);
    if (index < 0) throw new Error(`No existe la ejecución local ${runId}.`);

    runs[index] = {
      ...runs[index],
      fecha_fin: nowIso(),
      estado: options.ok === false ? "ERROR_EXPORTACION" : "COMPLETADO",
      archivos_exportados: options.files || {},
      carpeta_salida: normalizeText(options.outputDir || runs[index].carpeta_salida),
      mensaje_error: normalizeText(options.errorMessage)
    };

    this.database.replaceCollection(RUNS_COLLECTION, runs);
    return runs[index];
  }

  getDocumentsByPeriod(documentType, period) {
    return this.database.readCollection(DOCUMENTS_COLLECTION).filter((record) =>
      (!documentType || record.tipo_documental === documentType) &&
      (!period || record.periodo === period)
    );
  }
}

function createPersistenceService(databaseDirectory) {
  const service = new PersistenceService(path.resolve(databaseDirectory));
  service.initialize();
  return service;
}

module.exports = {
  DOCUMENTS_COLLECTION,
  RUNS_COLLECTION,
  createRunId,
  getParsedDocumentMetadata,
  calculateNextVersion,
  prepareDocumentPersistence,
  filterTableRows,
  PersistenceService,
  createPersistenceService
};
