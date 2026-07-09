/* =========================================================
Nombre completo: file.utils.js
Ruta o ubicación: /plan-docente-extractor/src/utils/file.utils.js
Función o funciones:
- Centralizar utilidades de rutas, extensiones y carpetas.
- Validar existencia de archivos y carpetas locales.
- Calcular tamaños de archivo en bytes, KB y MB.
- Crear carpetas de salida de forma segura cuando no existan.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

function normalizeFilePath(filePath) {
  return String(filePath || "").trim();
}

function getFileName(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  return cleanPath ? path.basename(cleanPath) : "";
}

function getExtension(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  return cleanPath ? path.extname(cleanPath).toLowerCase() : "";
}

function pathExists(targetPath) {
  const cleanPath = normalizeFilePath(targetPath);
  return Boolean(cleanPath && fs.existsSync(cleanPath));
}

function getStats(targetPath) {
  const cleanPath = normalizeFilePath(targetPath);

  if (!cleanPath) {
    return null;
  }

  try {
    return fs.statSync(cleanPath);
  } catch (error) {
    return null;
  }
}

function bytesToKB(bytes) {
  return Number((Number(bytes || 0) / 1024).toFixed(2));
}

function bytesToMB(bytes) {
  return Number((Number(bytes || 0) / 1024 / 1024).toFixed(2));
}

function isFile(targetPath) {
  const stat = getStats(targetPath);
  return Boolean(stat && stat.isFile());
}

function isDirectory(targetPath) {
  const stat = getStats(targetPath);
  return Boolean(stat && stat.isDirectory());
}

function ensureDirectory(directoryPath) {
  const cleanPath = normalizeFilePath(directoryPath);

  if (!cleanPath) {
    throw new Error("No se recibió una carpeta válida.");
  }

  if (!pathExists(cleanPath)) {
    fs.mkdirSync(cleanPath, { recursive: true });
  }

  if (!isDirectory(cleanPath)) {
    throw new Error("La ruta indicada no corresponde a una carpeta.");
  }

  return cleanPath;
}

function createFileInfo(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  const stat = getStats(cleanPath);
  const sizeBytes = stat && stat.isFile() ? stat.size : 0;

  return {
    path: cleanPath,
    name: getFileName(cleanPath),
    extension: getExtension(cleanPath),
    exists: pathExists(cleanPath),
    isFile: Boolean(stat && stat.isFile()),
    isDirectory: Boolean(stat && stat.isDirectory()),
    sizeBytes,
    sizeKB: bytesToKB(sizeBytes),
    sizeMB: bytesToMB(sizeBytes)
  };
}

function sanitizeFileName(value, fallback = "archivo") {
  return String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140) || fallback;
}

module.exports = {
  normalizeFilePath,
  getFileName,
  getExtension,
  pathExists,
  getStats,
  bytesToKB,
  bytesToMB,
  isFile,
  isDirectory,
  ensureDirectory,
  createFileInfo,
  sanitizeFileName
};
