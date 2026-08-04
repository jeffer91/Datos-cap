/* =========================================================
Nombre completo: importacion-masiva.service.js
Ruta o ubicación: /src/importacion-masiva/importacion-masiva.service.js
Función o funciones:
- Escanear una carpeta institucional completa sin exigir un tipo documental previo.
- Clasificar PDF por nombre, ruta, contenido digital y OCR breve.
- Separar archivos listos, ambiguos, no soportados, vacíos e inaccesibles.
- Distribuir automáticamente cada PDF compatible a su procesador.
- Conservar proceso, periodo académico y ruta de origen en la base local.
========================================================= */
"use strict";

const crypto = require("crypto");
const {
  listPdfFilesRecursive,
  createFileInfo,
  toDisplayPath
} = require("../utils/file.utils");
const { readPdfHybrid } = require("../readers/pdf-hybrid.reader");
const { detectDocumentTypeDetailed } = require("../validators/document-selection.validator");
const { deriveFolderContext } = require("../document-types/acuerdo-patrocinio/folder-context");
const { processReport } = require("../processors/report.processor");
const { processAgreementReport } = require("../processors/acuerdo-patrocinio.processor");
const { processPlanningReport } = require("../processors/planificacion-capacitacion.processor");
const { processFinalReport } = require("../processors/informe-final-capacitacion.processor");
const {
  processEvaluationInstrumentReport,
  processImpactReport
} = require("../processors/seguimiento-capacitacion.processor");
const { parsePathContext } = require("./path-context.parser");

const BATCH_COLLECTION = "_import_batches";
const FILE_COLLECTION = "_import_files";
const SUPPORTED_TYPES = Object.freeze([
  "plan-individual",
  "acuerdo-patrocinio",
  "planificacion-capacitacion",
  "informe-final-capacitacion",
  "instrumento-evaluacion",
  "informe-impacto"
]);
const TYPE_LABELS = Object.freeze({
  "plan-individual": "Plan Individual",
  "acuerdo-patrocinio": "Acuerdo de Patrocinio",
  "planificacion-capacitacion": "Planificación de Capacitación",
  "informe-final-capacitacion": "Informe Final de Capacitación",
  "instrumento-evaluacion": "Instrumento de Evaluación",
  "informe-impacto": "Informe de Impacto",
  desconocido: "No identificado"
});

function nowIso() { return new Date().toISOString(); }
function text(value) { return String(value == null ? "" : value).trim(); }
function pathKey(value) {
  return toDisplayPath(value).replace(/\//g, "\\").toLowerCase();
}
function makeId(prefix, seed = "") {
  if (seed) return `${prefix}_${crypto.createHash("sha1").update(seed).digest("hex")}`;
  if (typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${crypto.createHash("sha1").update(`${Date.now()}-${Math.random()}`).digest("hex")}`;
}
function emptyReadResult(filePath, message) {
  return {
    filePath,
    fileName: String(filePath || "").split(/[\\/]/).pop() || "",
    fileHash: "",
    pageCount: 0,
    digitalPageCount: 0,
    ocrPageCount: 0,
    ocrConfidence: 0,
    extractionMethod: "failed",
    text: "",
    ok: false,
    errors: message ? [message] : [],
    warnings: []
  };
}

function reconcileClassification(detection, context, readResult) {
  const detected = detection?.type || "desconocido";
  const hint = context?.pathHint || null;
  const reasons = [];
  let type = detected;
  let confidence = Number(detection?.confidence || 0);
  let status = "UNSUPPORTED";

  if (detected !== "desconocido") {
    reasons.push(detection.reason || "Tipo reconocido por el documento.");
    if (hint && hint.type !== detected) {
      reasons.push(`La carpeta sugiere ${TYPE_LABELS[hint.type] || hint.type}.`);
      status = "REVIEW";
      confidence = Math.min(confidence || 70, 79);
    } else {
      if (hint && hint.type === detected) {
        reasons.push(`La estructura de carpetas confirma ${TYPE_LABELS[detected]}.`);
        confidence = Math.max(confidence, hint.confidence || 0, 96);
      }
      status = confidence >= 85 && readResult?.ok !== false ? "READY" : "REVIEW";
    }
  } else if (hint) {
    type = hint.type;
    confidence = hint.confidence || 70;
    status = "REVIEW";
    reasons.push(`Clasificación inferida por la carpeta: ${hint.source}.`);
  } else {
    reasons.push("No se encontraron señales suficientes para un tipo compatible.");
  }

  if (!SUPPORTED_TYPES.includes(type)) {
    type = "desconocido";
    status = "UNSUPPORTED";
    confidence = 0;
  }
  if (readResult?.ok === false && type !== "desconocido") {
    status = "REVIEW";
    reasons.push("El contenido no pudo verificarse completamente; se conservó la clasificación por nombre o ruta.");
  }

  return {
    detectedType: type,
    detectedLabel: TYPE_LABELS[type] || type,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    status,
    requiresReview: status === "REVIEW",
    reasons,
    detectionSignals: detection?.signals || [],
    pathHint: hint
  };
}

function summarizeFiles(files) {
  const rows = Array.isArray(files) ? files : [];
  const byType = {};
  const byStatus = {};
  const academicPeriods = new Set();
  rows.forEach((row) => {
    byType[row.detectedType || "desconocido"] = Number(byType[row.detectedType || "desconocido"] || 0) + 1;
    byStatus[row.status || "UNKNOWN"] = Number(byStatus[row.status || "UNKNOWN"] || 0) + 1;
    if (row.academicPeriod) academicPeriods.add(row.academicPeriod);
  });
  return {
    total: rows.length,
    ready: Number(byStatus.READY || 0),
    review: Number(byStatus.REVIEW || 0),
    unsupported: Number(byStatus.UNSUPPORTED || 0),
    empty: Number(byStatus.EMPTY || 0),
    inaccessible: Number(byStatus.INACCESSIBLE || 0),
    processed: Number(byStatus.PROCESSED || 0),
    failed: Number(byStatus.PROCESSING_ERROR || 0),
    digital: rows.filter((row) => row.extractionMethod === "digital").length,
    ocr: rows.filter((row) => ["ocr", "mixed"].includes(row.extractionMethod)).length,
    academicPeriods: [...academicPeriods].sort((a, b) => a.localeCompare(b, "es")),
    byType,
    byStatus
  };
}

function processorFor(documentType) {
  if (documentType === "plan-individual") return processReport;
  if (documentType === "acuerdo-patrocinio") return processAgreementReport;
  if (documentType === "planificacion-capacitacion") return processPlanningReport;
  if (documentType === "informe-final-capacitacion") return processFinalReport;
  if (documentType === "instrumento-evaluacion") return processEvaluationInstrumentReport;
  if (documentType === "informe-impacto") return processImpactReport;
  return null;
}

class MassImportService {
  constructor(persistenceService) {
    if (!persistenceService?.database) throw new Error("La importación masiva requiere la base local.");
    this.persistenceService = persistenceService;
    this.database = persistenceService.database;
  }

  readSafe(collection) {
    try { return this.database.readCollection(collection); }
    catch (_error) { return []; }
  }

  saveBatch(batch, files) {
    this.database.upsertMany(BATCH_COLLECTION, [batch], "id");
    if (Array.isArray(files) && files.length) this.database.upsertMany(FILE_COLLECTION, files, "id");
  }

  getBatch(batchId) {
    const id = text(batchId);
    const batch = this.readSafe(BATCH_COLLECTION).find((row) => row.id === id);
    if (!batch) throw new Error("No se encontró la importación solicitada.");
    const files = this.readSafe(FILE_COLLECTION).filter((row) => row.batchId === id);
    return { batch, files, summary: summarizeFiles(files) };
  }

  async scanFolder(rootPath, options = {}) {
    const cleanRoot = toDisplayPath(rootPath);
    const scan = listPdfFilesRecursive(cleanRoot, {
      maxFiles: Number(options.maxFiles || 10000),
      maxDepth: Number(options.maxDepth || 60)
    });
    const batchId = makeId("import");
    const startedAt = nowIso();
    const files = [];

    for (let index = 0; index < scan.entries.length; index += 1) {
      const entry = scan.entries[index];
      const info = createFileInfo(entry.path);
      const context = parsePathContext(entry);
      if (typeof options.onFileStart === "function") {
        options.onFileStart(index + 1, scan.entries.length, entry.path);
      }

      let readResult;
      let classification;
      if (!info.exists || !info.isFile) {
        readResult = emptyReadResult(entry.path, "El archivo no está disponible localmente.");
        classification = {
          detectedType: "desconocido",
          detectedLabel: TYPE_LABELS.desconocido,
          confidence: 0,
          status: "INACCESSIBLE",
          requiresReview: true,
          reasons: ["OneDrive o Windows no permitió acceder al archivo."],
          detectionSignals: [],
          pathHint: context.pathHint
        };
      } else if (info.sizeBytes <= 0) {
        readResult = emptyReadResult(entry.path, "El PDF tiene tamaño de 0 bytes.");
        classification = {
          detectedType: context.pathHint?.type || "desconocido",
          detectedLabel: TYPE_LABELS[context.pathHint?.type] || TYPE_LABELS.desconocido,
          confidence: 0,
          status: "EMPTY",
          requiresReview: true,
          reasons: ["El archivo está vacío y no puede procesarse."],
          detectionSignals: [],
          pathHint: context.pathHint
        };
      } else {
        readResult = await readPdfHybrid(entry.path, index, {
          quality: { minCharacters: 100, minWords: 15 },
          ocr: { maxPages: 2, scale: 1.8 },
          onModeChange: options.onModeChange,
          onProgress: options.onOcrProgress,
          onPageStart: options.onPageStart,
          onPageRender: options.onPageRender
        });
        const detection = detectDocumentTypeDetailed(readResult.text || "", readResult.fileName || context.fileName);
        classification = reconcileClassification(detection, context, readResult);
      }

      const file = {
        id: makeId("import_file", `${batchId}|${pathKey(entry.path)}`),
        batchId,
        rootPath: scan.rootPath,
        path: entry.path,
        relativePath: entry.relativePath,
        directorySegments: entry.directorySegments,
        parentFolder: entry.parentFolder,
        sourceType: "folder",
        sizeBytes: info.sizeBytes,
        fileHash: readResult.fileHash || "",
        pageCount: Number(readResult.pageCount || 0),
        extractionMethod: readResult.extractionMethod || "",
        digitalPageCount: Number(readResult.digitalPageCount || 0),
        ocrPageCount: Number(readResult.ocrPageCount || 0),
        ocrConfidence: Number(readResult.ocrConfidence || 0),
        processCode: context.processCode,
        processCodes: context.processCodes,
        academicPeriod: context.academicPeriod,
        academicPeriodStart: context.academicPeriodStart,
        academicPeriodEnd: context.academicPeriodEnd,
        documentMonth: context.documentMonth,
        documentFolder: context.documentFolder,
        detectedType: classification.detectedType,
        detectedLabel: classification.detectedLabel,
        confidence: classification.confidence,
        status: classification.status,
        requiresReview: classification.requiresReview,
        reasons: classification.reasons,
        detectionSignals: classification.detectionSignals,
        errors: readResult.errors || [],
        warnings: readResult.warnings || [],
        scannedAt: nowIso(),
        processedAt: "",
        processingMessage: ""
      };
      files.push(file);
      if (typeof options.onFileClassified === "function") {
        options.onFileClassified(index + 1, scan.entries.length, file);
      }
    }

    const summary = summarizeFiles(files);
    const batch = {
      id: batchId,
      rootPath: scan.rootPath,
      status: "SCANNED",
      startedAt,
      scannedAt: nowIso(),
      processedAt: "",
      fileCount: files.length,
      truncated: scan.truncated,
      scanErrors: scan.errors,
      summary
    };
    this.saveBatch(batch, files);
    return { ok: true, batch, files, summary, scan: { errors: scan.errors, truncated: scan.truncated, maxFiles: scan.maxFiles } };
  }

  metadataFor(file) {
    return {
      import_batch_id: file.batchId,
      carpeta_raiz_origen: file.rootPath,
      ruta_relativa_origen: file.relativePath,
      proceso_codigo: file.processCode,
      periodo_academico: file.academicPeriod,
      periodo_inicio: file.academicPeriodStart,
      periodo_fin: file.academicPeriodEnd,
      mes_documento: file.documentMonth,
      subcarpeta_documental: file.documentFolder,
      clasificacion_confianza: file.confidence,
      clasificacion_estado: file.requiresReview ? "REQUIERE_REVISION" : "AUTOMATICA"
    };
  }

  applyImportMetadata(files) {
    const candidates = Array.isArray(files) ? files : [];
    const byPath = new Map(candidates.map((file) => [pathKey(file.path), file]));
    const byHash = new Map(candidates.filter((file) => file.fileHash).map((file) => [`${file.detectedType}|${file.fileHash}`, file]));
    const documents = this.readSafe("_documents");
    const metadataByDocumentId = new Map();
    let documentsUpdated = 0;

    const updatedDocuments = documents.map((document) => {
      const file = byPath.get(pathKey(document.ruta_archivo)) || byHash.get(`${document.tipo_documental}|${document.hash_archivo}`);
      if (!file) return document;
      const metadata = this.metadataFor(file);
      const id = text(document.id_documento || document.id);
      if (id) metadataByDocumentId.set(id, metadata);
      documentsUpdated += 1;
      return { ...document, ...metadata };
    });
    if (documentsUpdated) this.database.replaceCollection("_documents", updatedDocuments);

    let relatedRowsUpdated = 0;
    this.database.listCollections()
      .filter((name) => !name.startsWith("_") && ![BATCH_COLLECTION, FILE_COLLECTION].includes(name))
      .forEach((collection) => {
        const rows = this.readSafe(collection);
        let changed = false;
        const updated = rows.map((row) => {
          const metadata = metadataByDocumentId.get(text(row?.id_documento));
          if (!metadata) return row;
          changed = true;
          relatedRowsUpdated += 1;
          return { ...row, ...metadata };
        });
        if (changed) this.database.replaceCollection(collection, updated);
      });

    return { documentsUpdated, relatedRowsUpdated };
  }

  async processBatch(payload = {}, options = {}) {
    const current = this.getBatch(payload.batchId);
    const selectedIds = new Set(Array.isArray(payload.fileIds) ? payload.fileIds : []);
    const includeReview = payload.includeReview === true;
    const outputDir = text(payload.outputDir);
    if (!outputDir) throw new Error("Selecciona una carpeta de salida antes de procesar.");

    const selected = current.files.filter((file) => {
      if (selectedIds.size && !selectedIds.has(file.id)) return false;
      if (!SUPPORTED_TYPES.includes(file.detectedType)) return false;
      return file.status === "READY" || (includeReview && file.status === "REVIEW");
    });
    if (!selected.length) throw new Error("No existen documentos clasificados y habilitados para procesar.");

    const groups = new Map();
    selected.forEach((file) => {
      if (!groups.has(file.detectedType)) groups.set(file.detectedType, []);
      groups.get(file.detectedType).push(file);
    });

    const results = {};
    const processedFiles = [];
    for (const [documentType, files] of groups.entries()) {
      const processor = processorFor(documentType);
      if (!processor) continue;
      if (typeof options.onGroupStart === "function") options.onGroupStart(documentType, files.length);
      const validFiles = files.map((file) => {
        const entry = {
          path: file.path,
          name: String(file.path || "").split(/[\\/]/).pop() || "",
          valid: true,
          detectedType: documentType,
          typeMatch: true,
          sourceType: "folder",
          rootPath: file.rootPath,
          relativePath: file.relativePath,
          directorySegments: file.directorySegments || [],
          parentFolder: file.parentFolder || "",
          fileHash: file.fileHash,
          extractionMethod: file.extractionMethod,
          pageCount: file.pageCount,
          ocrPageCount: file.ocrPageCount,
          ocrConfidence: file.ocrConfidence,
          errors: [],
          warnings: file.warnings || []
        };
        if (documentType === "acuerdo-patrocinio") entry.folderContext = deriveFolderContext(entry);
        return entry;
      });
      const validation = {
        documentType,
        total: validFiles.length,
        validCount: validFiles.length,
        invalidCount: 0,
        files: validFiles,
        validFiles,
        invalidFiles: [],
        canContinue: true
      };

      try {
        const result = await processor({
          outputDir,
          validation,
          persistenceService: this.persistenceService,
          onDocumentStart: options.onDocumentStart,
          onModeChange: options.onModeChange,
          onOcrProgress: options.onOcrProgress,
          onPageStart: options.onPageStart,
          onPageRender: options.onPageRender
        });
        results[documentType] = result;
        files.forEach((file) => processedFiles.push({ ...file, status: result.ok ? "PROCESSED" : "PROCESSING_ERROR", processedAt: nowIso(), processingMessage: result.message || "" }));
      } catch (error) {
        results[documentType] = { ok: false, message: error.message, files: {}, summary: {} };
        files.forEach((file) => processedFiles.push({ ...file, status: "PROCESSING_ERROR", processedAt: nowIso(), processingMessage: error.message }));
      }
    }

    if (processedFiles.length) this.database.upsertMany(FILE_COLLECTION, processedFiles, "id");
    const metadata = this.applyImportMetadata(selected);
    const refreshedFiles = this.readSafe(FILE_COLLECTION).filter((row) => row.batchId === current.batch.id);
    const summary = summarizeFiles(refreshedFiles);
    const batch = {
      ...current.batch,
      status: summary.failed ? "PROCESSED_WITH_ERRORS" : "PROCESSED",
      processedAt: nowIso(),
      outputDir,
      summary,
      metadata
    };
    this.database.upsertMany(BATCH_COLLECTION, [batch], "id");

    return {
      ok: Object.values(results).some((result) => result.ok),
      message: summary.failed
        ? "La importación terminó con documentos que requieren revisión."
        : "La carpeta fue clasificada, procesada y guardada correctamente.",
      batch,
      summary,
      metadata,
      results,
      files: refreshedFiles
    };
  }
}

function createMassImportService(persistenceService) {
  return new MassImportService(persistenceService);
}

module.exports = {
  BATCH_COLLECTION,
  FILE_COLLECTION,
  SUPPORTED_TYPES,
  TYPE_LABELS,
  reconcileClassification,
  summarizeFiles,
  MassImportService,
  createMassImportService
};
