/* =========================================================
Nombre completo: folder-context.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/folder-context.js
Función o funciones:
- Detectar la capacitación a partir de la estructura de carpetas.
- Ignorar carpetas genéricas como Firmados, Documentos o PDF.
- Comparar la capacitación de la carpeta con la extraída del acuerdo.
- Conservar trazabilidad y marcar conflictos para revisión.
========================================================= */

"use strict";

const path = require("path");
const { normalizeForSearch, cleanValue } = require("../../extractor/normalizer");
const { isWindowsStylePath, toDisplayPath } = require("../../utils/file.utils");

const GENERIC_FOLDERS = new Set([
  "acuerdo", "acuerdos", "acuerdo de patrocinio", "acuerdos de patrocinio",
  "documento", "documentos", "archivo", "archivos", "pdf", "pdfs",
  "firmado", "firmados", "signed", "escaneado", "escaneados",
  "final", "finales", "pendiente", "pendientes", "aprobado", "aprobados",
  "anexo", "anexos", "copia", "copias", "digital", "digitales",
  "carpeta", "carpetas", "respaldo", "respaldos"
]);

const TRAINING_STOPWORDS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e", "en", "para", "por",
  "un", "una", "curso", "capacitacion", "formacion", "docente", "docentes"
]);

function pathApiFor(value) {
  return isWindowsStylePath(value) ? path.win32 : path;
}

function cleanFolderTrainingName(value) {
  return cleanValue(String(value || ""))
    .replace(/^(?:UGPA|CGC)\s*[-–—_]\s*RGI2(?:\s*[-–—_]\s*\d{1,3})?\s*[-–—_]\s*PRO\s*[-–—_]?\s*134\s*[-–—_]?\s*/i, "")
    .replace(/^UGPA\s*[-–—_]\s*RGI2\s*[-–—_]\s*PRO\s*[-–—_]?\s*134\s*[-–—_]?\s*/i, "")
    .replace(/^ACUERDOS?\s+DE\s+PATROCINIO(?:\s+INSTITUCIONAL)?\s*[-–—_:]?\s*/i, "")
    .replace(/^PATROCINIO\s+INSTITUCIONAL\s*[-–—_:]?\s*/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericFolder(value) {
  const clean = cleanFolderTrainingName(value);
  const normalized = normalizeForSearch(clean);
  if (!normalized) return true;
  if (GENERIC_FOLDERS.has(normalized)) return true;
  if (/^(?:19|20)\d{2}$/.test(normalized)) return true;
  if (/^(?:0?[1-9]|1[0-2])(?:[- /](?:19|20)\d{2})?$/.test(normalized)) return true;
  if (/^(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+\d{4})?$/.test(normalized)) return true;
  return normalized.length < 4;
}

function deriveFolderContext(entry = {}) {
  const filePath = toDisplayPath(entry.path || entry.filePath || "");
  const rootPath = toDisplayPath(entry.rootPath || "");
  const pathApi = pathApiFor(rootPath || filePath);
  let relativePath = String(entry.relativePath || "").trim();
  if (!relativePath && rootPath && filePath) relativePath = pathApi.relative(rootPath, filePath);
  if (!relativePath && filePath) relativePath = pathApi.basename(filePath);

  const relativeDirectory = relativePath ? pathApi.dirname(relativePath) : ".";
  const directorySegments = Array.isArray(entry.directorySegments) && entry.directorySegments.length
    ? entry.directorySegments.filter(Boolean)
    : (relativeDirectory && relativeDirectory !== "." ? relativeDirectory.split(/[\\/]+/).filter(Boolean) : []);

  const rootName = rootPath ? pathApi.basename(rootPath) : "";
  const candidates = [...directorySegments].reverse();
  if (rootName) candidates.push(rootName);
  const originalTrainingFolder = candidates.find((segment) => !isGenericFolder(segment)) || "";
  const detectedTraining = cleanFolderTrainingName(originalTrainingFolder);

  return {
    sourceType: entry.sourceType || (rootPath ? "folder" : "individual"),
    rootPath,
    relativePath,
    depth: Number.isFinite(entry.depth) ? entry.depth : directorySegments.length,
    parentFolder: entry.parentFolder || directorySegments[directorySegments.length - 1] || "",
    directorySegments,
    originalTrainingFolder,
    detectedTraining
  };
}

function trainingTokens(value) {
  return normalizeForSearch(value)
    .split(/[^a-z0-9ñ]+/i)
    .filter((token) => token && token.length > 1 && !TRAINING_STOPWORDS.has(token));
}

function trainingSimilarity(left, right) {
  const normalizedLeft = normalizeForSearch(left);
  const normalizedRight = normalizeForSearch(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 100;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 95;

  const leftTokens = new Set(trainingTokens(left));
  const rightTokens = new Set(trainingTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? Math.round((intersection / union) * 100) : 0;
}

function reconcileAgreementTraining(pdfTraining, folderContext = {}) {
  const fromPdf = cleanValue(pdfTraining || "");
  const fromFolder = cleanValue(folderContext.detectedTraining || "");

  if (fromPdf && fromFolder) {
    const similarity = trainingSimilarity(fromPdf, fromFolder);
    const status = similarity >= 75 ? "CONFIRMADA" : similarity >= 50 ? "PROBABLE" : "CONFLICTO";
    return {
      pdfTraining: fromPdf,
      folderTraining: fromFolder,
      finalTraining: fromPdf,
      source: "PDF_Y_CARPETA",
      similarity,
      status,
      requiresReview: status !== "CONFIRMADA"
    };
  }

  if (fromPdf) {
    return {
      pdfTraining: fromPdf,
      folderTraining: "",
      finalTraining: fromPdf,
      source: "PDF",
      similarity: "",
      status: folderContext.sourceType === "folder" ? "SIN_CARPETA_IDENTIFICABLE" : "SOLO_PDF",
      requiresReview: false
    };
  }

  if (fromFolder) {
    return {
      pdfTraining: "",
      folderTraining: fromFolder,
      finalTraining: fromFolder,
      source: "CARPETA",
      similarity: "",
      status: "SOLO_CARPETA",
      requiresReview: true
    };
  }

  return {
    pdfTraining: "",
    folderTraining: "",
    finalTraining: "",
    source: "NO_DETERMINADA",
    similarity: "",
    status: "NO_DETERMINADA",
    requiresReview: true
  };
}

function appendObservation(current, message) {
  return [String(current || "").trim(), String(message || "").trim()].filter(Boolean).join(" | ");
}

function applyAgreementFolderContext(document, selectionEntry = {}) {
  if (!document) return document;
  const folderContext = deriveFolderContext(selectionEntry);
  const data = document.datos_acuerdo || {};
  const file = document.archivo || {};
  const reconciliation = reconcileAgreementTraining(data.nombre_capacitacion, folderContext);
  const originFields = {
    origen_carga: folderContext.sourceType === "folder" ? "CARPETA" : "PDF_INDIVIDUAL",
    carpeta_raiz: folderContext.rootPath,
    ruta_relativa: folderContext.relativePath,
    nivel_profundidad: folderContext.depth,
    carpeta_padre: folderContext.parentFolder,
    carpeta_capacitacion_original: folderContext.originalTrainingFolder,
    capacitacion_detectada_carpeta: reconciliation.folderTraining,
    capacitacion_detectada_pdf: reconciliation.pdfTraining,
    capacitacion_final: reconciliation.finalTraining,
    fuente_capacitacion: reconciliation.source,
    porcentaje_coincidencia: reconciliation.similarity,
    estado_coincidencia: reconciliation.status
  };

  Object.assign(file, originFields);
  Object.assign(data, originFields);
  if (!data.nombre_capacitacion && reconciliation.finalTraining) data.nombre_capacitacion = reconciliation.finalTraining;

  let warning = "";
  if (reconciliation.status === "CONFLICTO") {
    warning = `La capacitación del PDF (${reconciliation.pdfTraining}) no coincide con la carpeta (${reconciliation.folderTraining}).`;
  } else if (reconciliation.status === "PROBABLE") {
    warning = `La capacitación del PDF y la carpeta solo presentan una coincidencia probable (${reconciliation.similarity}%).`;
  } else if (reconciliation.status === "SOLO_CARPETA") {
    warning = "La capacitación no se leyó del PDF y se tomó de la carpeta; requiere confirmación.";
  } else if (reconciliation.status === "NO_DETERMINADA") {
    warning = "No se pudo determinar la capacitación ni desde el PDF ni desde la carpeta.";
  }

  if (warning) {
    file.requiere_revision = "SI";
    file.estado_extraccion = "REVISAR";
    file.observacion_extraccion = appendObservation(file.observacion_extraccion, warning);
    data.requiere_revision = "SI";
    data.observacion_extraccion = appendObservation(data.observacion_extraccion, warning);
    document.warnings = [...(document.warnings || []), warning];
  }

  document.archivo = file;
  document.datos_acuerdo = data;
  document.folder_context = folderContext;
  document.training_reconciliation = reconciliation;
  return document;
}

module.exports = {
  GENERIC_FOLDERS,
  cleanFolderTrainingName,
  isGenericFolder,
  deriveFolderContext,
  trainingTokens,
  trainingSimilarity,
  reconcileAgreementTraining,
  applyAgreementFolderContext
};