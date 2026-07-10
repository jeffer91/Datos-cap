/* =========================================================
Nombre completo: document.validator.js
Ruta o ubicación: /src/validators/document.validator.js
Función o funciones:
- Validar documentos PDF antes de iniciar la extracción.
- Detectar archivos inexistentes, vacíos, duplicados o con extensión incorrecta.
- Calcular hash SHA-256 para detectar duplicados reales aunque cambie la ruta.
- Aplicar reglas del apartado seleccionado y advertir posibles tipos incorrectos.
========================================================= */

"use strict";

const path = require("path");
const { normalizeFilePath, createFileInfo } = require("../utils/file.utils");
const { calculateFileHash } = require("../utils/hash.utils");
const { getDocumentType, hasDocumentType } = require("../core/document-type.registry");

const VALID_EXTENSIONS = new Set([".pdf"]);

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function validateTypeHint(fileName, definition) {
  const hints = definition && Array.isArray(definition.fileNameHints)
    ? definition.fileNameHints.filter(Boolean)
    : [];

  if (!hints.length) {
    return { checked: false, matches: true, missingHints: [] };
  }

  const normalizedName = normalizeSearch(fileName);
  const missingHints = hints.filter((hint) => !normalizedName.includes(normalizeSearch(hint)));

  return {
    checked: true,
    matches: missingHints.length === 0,
    missingHints
  };
}

function validatePdfFile(filePath, options = {}) {
  const definition = getDocumentType(options.documentType);
  const info = createFileInfo(filePath);
  const typeCheck = validateTypeHint(info.name, definition);
  const result = {
    path: info.path,
    name: info.name,
    extension: info.extension,
    sizeBytes: info.sizeBytes,
    sizeKB: info.sizeKB,
    sizeMB: info.sizeMB,
    exists: info.exists,
    isPdf: info.extension === ".pdf",
    fileHash: "",
    documentType: definition ? definition.id : "",
    typeMatch: typeCheck.matches,
    valid: false,
    duplicate: false,
    errors: [],
    warnings: []
  };

  if (!normalizeFilePath(filePath)) result.errors.push("Ruta vacía.");
  if (!result.exists) result.errors.push("El archivo no existe.");
  if (result.exists && !info.isFile) result.errors.push("La ruta no corresponde a un archivo.");
  if (!VALID_EXTENSIONS.has(result.extension)) result.errors.push("Solo se permiten archivos PDF.");
  if (result.exists && info.isFile && result.sizeBytes <= 0) result.errors.push("El archivo está vacío.");

  if (result.exists && info.isFile && result.isPdf) {
    result.fileHash = calculateFileHash(info.path);
    if (!result.fileHash) result.errors.push("No se pudo calcular la huella digital del archivo.");
  }

  if (typeCheck.checked && !typeCheck.matches) {
    result.warnings.push(
      `El nombre del archivo no contiene las referencias esperadas para ${definition.shortLabel}: ${typeCheck.missingHints.join(", ")}.`
    );
  }

  result.valid = result.errors.length === 0;
  return result;
}

function createDuplicateKey(file) {
  if (file && file.fileHash) return `hash:${file.fileHash}`;
  const cleanPath = normalizeFilePath(file ? file.path : "");
  return cleanPath ? `path:${path.resolve(cleanPath).toLowerCase()}` : "";
}

function validatePdfFiles(filePaths, options = {}) {
  const receivedPaths = Array.isArray(filePaths) ? filePaths : [];
  const definition = getDocumentType(options.documentType);
  const seen = new Set();

  const files = receivedPaths.map((item) => {
    const info = validatePdfFile(item, options);
    const duplicateKey = createDuplicateKey(info);

    if (duplicateKey && seen.has(duplicateKey)) {
      info.duplicate = true;
      info.valid = false;
      info.errors.push("Archivo duplicado en la selección según su contenido.");
    } else if (duplicateKey) {
      seen.add(duplicateKey);
    }

    return info;
  });

  if (definition && !definition.allowMultiple) {
    const validIndexes = files
      .map((file, index) => (file.valid ? index : -1))
      .filter((index) => index >= 0);

    validIndexes.slice(1).forEach((index) => {
      files[index].valid = false;
      files[index].errors.push("Este apartado admite un solo documento por operación.");
    });
  }

  const validFiles = files.filter((file) => file.valid);
  const invalidFiles = files.filter((file) => !file.valid);

  return {
    documentType: definition ? definition.id : "",
    total: files.length,
    validCount: validFiles.length,
    invalidCount: invalidFiles.length,
    duplicateCount: files.filter((file) => file.duplicate).length,
    typeWarningCount: files.filter((file) => file.warnings.length > 0).length,
    files,
    validFiles,
    invalidFiles,
    canContinue: validFiles.length > 0
  };
}

function validateOutputRequest(payload) {
  const config = payload || {};
  const issues = [];

  if (!hasDocumentType(config.documentType)) issues.push("No se recibió un tipo documental válido.");
  if (!Array.isArray(config.filePaths) || !config.filePaths.length) issues.push("No se recibieron rutas de PDF.");
  if (!normalizeFilePath(config.outputDir)) issues.push("No se recibió carpeta de salida.");

  return { ok: issues.length === 0, issues };
}

module.exports = {
  VALID_EXTENSIONS,
  normalizeSearch,
  validateTypeHint,
  validatePdfFile,
  validatePdfFiles,
  validateOutputRequest
};
