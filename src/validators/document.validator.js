/* =========================================================
Nombre completo: document.validator.js
Ruta o ubicación: /src/validators/document.validator.js
Función o funciones:
- Validar existencia, extensión, tamaño y duplicados de PDF.
- Calcular huella SHA-256 para deduplicación local.
========================================================= */
"use strict";

const path = require("path");
const { normalizeFilePath, createFileInfo } = require("../utils/file.utils");
const { calculateFileHash } = require("../utils/hash.utils");

const VALID_EXTENSIONS = new Set([".pdf"]);

function validatePdfFile(filePath) {
  const info = createFileInfo(filePath);
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
    valid: false,
    duplicate: false,
    errors: []
  };
  if (!normalizeFilePath(filePath)) result.errors.push("Ruta vacía.");
  if (!result.exists) result.errors.push("El archivo no existe.");
  if (result.exists && !info.isFile) result.errors.push("La ruta no corresponde a un archivo.");
  if (!VALID_EXTENSIONS.has(result.extension)) result.errors.push("Solo se permiten archivos PDF.");
  if (result.exists && info.isFile && result.sizeBytes <= 0) result.errors.push("El archivo está vacío.");
  if (!result.errors.length) {
    try { result.fileHash = calculateFileHash(info.path); }
    catch (error) { result.errors.push(`No se pudo calcular la huella del archivo: ${error.message}`); }
  }
  result.valid = result.errors.length === 0;
  return result;
}

function validatePdfFiles(filePaths) {
  const received = Array.isArray(filePaths) ? filePaths : [];
  const seenPaths = new Set();
  const seenHashes = new Set();
  const files = received.map((item) => {
    const info = validatePdfFile(item);
    const pathKey = normalizeFilePath(info.path) ? path.resolve(info.path).toLowerCase() : "";
    const hashKey = String(info.fileHash || "").toLowerCase();
    if ((pathKey && seenPaths.has(pathKey)) || (hashKey && seenHashes.has(hashKey))) {
      info.duplicate = true;
      info.valid = false;
      info.errors.push("Archivo duplicado en la selección.");
    } else {
      if (pathKey) seenPaths.add(pathKey);
      if (hashKey) seenHashes.add(hashKey);
    }
    return info;
  });
  const validFiles = files.filter((file) => file.valid);
  const invalidFiles = files.filter((file) => !file.valid);
  return {
    total: files.length,
    validCount: validFiles.length,
    invalidCount: invalidFiles.length,
    duplicateCount: files.filter((file) => file.duplicate).length,
    files,
    validFiles,
    invalidFiles,
    canContinue: validFiles.length > 0
  };
}

function validateOutputRequest(payload) {
  const config = payload || {};
  const issues = [];
  if (!Array.isArray(config.filePaths) || !config.filePaths.length) issues.push("No se recibieron rutas de PDF.");
  if (!normalizeFilePath(config.outputDir)) issues.push("No se recibió carpeta de salida.");
  if (!config.documentType) issues.push("No se recibió el tipo documental.");
  return { ok: issues.length === 0, issues };
}

module.exports = { VALID_EXTENSIONS, validatePdfFile, validatePdfFiles, validateOutputRequest };
