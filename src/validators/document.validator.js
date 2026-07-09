/* =========================================================
Nombre completo: document.validator.js
Ruta o ubicación: /plan-docente-extractor/src/validators/document.validator.js
Función o funciones:
- Validar documentos PDF antes de iniciar la extracción.
- Detectar archivos inexistentes, vacíos, duplicados o con extensión incorrecta.
- Separar documentos válidos e inválidos para continuar solo con los correctos.
- Entregar un resumen uniforme para la interfaz y el procesador.
========================================================= */

"use strict";

const path = require("path");
const {
  normalizeFilePath,
  createFileInfo
} = require("../utils/file.utils");

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
    valid: false,
    duplicate: false,
    errors: []
  };

  if (!normalizeFilePath(filePath)) {
    result.errors.push("Ruta vacía.");
  }

  if (!result.exists) {
    result.errors.push("El archivo no existe.");
  }

  if (result.exists && !info.isFile) {
    result.errors.push("La ruta no corresponde a un archivo.");
  }

  if (!VALID_EXTENSIONS.has(result.extension)) {
    result.errors.push("Solo se permiten archivos PDF.");
  }

  if (result.exists && info.isFile && result.sizeBytes <= 0) {
    result.errors.push("El archivo está vacío.");
  }

  result.valid = result.errors.length === 0;

  return result;
}

function createDuplicateKey(filePath) {
  const cleanPath = normalizeFilePath(filePath);

  if (!cleanPath) {
    return "";
  }

  return path.resolve(cleanPath).toLowerCase();
}

function validatePdfFiles(filePaths) {
  const receivedPaths = Array.isArray(filePaths) ? filePaths : [];
  const seen = new Set();

  const files = receivedPaths.map((item) => {
    const info = validatePdfFile(item);
    const duplicateKey = createDuplicateKey(info.path);

    if (duplicateKey && seen.has(duplicateKey)) {
      info.duplicate = true;
      info.valid = false;
      info.errors.push("Archivo duplicado en la selección.");
    } else if (duplicateKey) {
      seen.add(duplicateKey);
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

  if (!Array.isArray(config.filePaths) || !config.filePaths.length) {
    issues.push("No se recibieron rutas de PDF.");
  }

  if (!normalizeFilePath(config.outputDir)) {
    issues.push("No se recibió carpeta de salida.");
  }

  return {
    ok: issues.length === 0,
    issues
  };
}

module.exports = {
  VALID_EXTENSIONS,
  validatePdfFile,
  validatePdfFiles,
  validateOutputRequest
};
