/* =========================================================
Nombre completo: file.utils.js
Ruta o ubicación: /src/utils/file.utils.js
Función o funciones:
- Centralizar utilidades de rutas, extensiones y carpetas.
- Convertir rutas de Windows al formato extendido \\?\ para superar MAX_PATH.
- Validar existencia de archivos y carpetas locales.
- Buscar PDF de forma recursiva desde una carpeta superior.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

function normalizeFilePath(filePath) {
  const value = String(filePath || "").trim();
  if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function isWindowsStylePath(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  return /^[a-z]:[\\/]/i.test(cleanPath) || /^\\\\/.test(cleanPath) || /^\\\\\?\\/.test(cleanPath);
}

function toDisplayPath(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  if (/^\\\\\?\\UNC\\/i.test(cleanPath)) return `\\\\${cleanPath.slice(8)}`;
  if (/^\\\\\?\\/i.test(cleanPath)) return cleanPath.slice(4);
  return cleanPath;
}

function toLongPath(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  if (!cleanPath || process.platform !== "win32") return cleanPath;
  if (/^\\\\\?\\/.test(cleanPath)) return cleanPath;

  const displayPath = toDisplayPath(cleanPath);
  if (/^\\\\/.test(displayPath)) return `\\\\?\\UNC\\${displayPath.slice(2)}`;

  const absolutePath = path.win32.isAbsolute(displayPath)
    ? path.win32.normalize(displayPath)
    : path.win32.resolve(displayPath);
  return `\\\\?\\${absolutePath}`;
}

function pathApiFor(filePath) {
  return isWindowsStylePath(filePath) ? path.win32 : path;
}

function getFileName(filePath) {
  const cleanPath = toDisplayPath(filePath);
  return cleanPath ? pathApiFor(cleanPath).basename(cleanPath) : "";
}

function getExtension(filePath) {
  const cleanPath = toDisplayPath(filePath);
  return cleanPath ? pathApiFor(cleanPath).extname(cleanPath).toLowerCase() : "";
}

function pathExists(targetPath) {
  const cleanPath = normalizeFilePath(targetPath);
  return Boolean(cleanPath && fs.existsSync(toLongPath(cleanPath)));
}

function getStats(targetPath) {
  const cleanPath = normalizeFilePath(targetPath);
  if (!cleanPath) return null;

  try {
    return fs.statSync(toLongPath(cleanPath));
  } catch (_error) {
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
  const cleanPath = toDisplayPath(directoryPath);
  if (!cleanPath) throw new Error("No se recibió una carpeta válida.");

  if (!pathExists(cleanPath)) fs.mkdirSync(toLongPath(cleanPath), { recursive: true });
  if (!isDirectory(cleanPath)) throw new Error("La ruta indicada no corresponde a una carpeta.");
  return cleanPath;
}

function createFileInfo(filePath) {
  const cleanPath = toDisplayPath(filePath);
  const stat = getStats(cleanPath);
  const sizeBytes = stat && stat.isFile() ? stat.size : 0;

  return {
    path: cleanPath,
    nativePath: toLongPath(cleanPath),
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

function listPdfFilesRecursive(directoryPath, options = {}) {
  const rootPath = toDisplayPath(directoryPath);
  if (!rootPath || !isDirectory(rootPath)) throw new Error("La carpeta seleccionada no existe o no se puede leer.");

  const maxFiles = Number.isFinite(options.maxFiles) ? Math.max(1, options.maxFiles) : 5000;
  const maxDepth = Number.isFinite(options.maxDepth) ? Math.max(0, options.maxDepth) : 30;
  const files = [];
  const errors = [];
  const stack = [{ directory: rootPath, depth: 0 }];
  const joinApi = pathApiFor(rootPath);
  let truncated = false;

  while (stack.length && !truncated) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(toLongPath(current.directory), { withFileTypes: true });
    } catch (error) {
      errors.push({ path: current.directory, message: error.message || "No se pudo leer la carpeta." });
      continue;
    }

    for (const entry of entries) {
      const childPath = joinApi.join(current.directory, entry.name);
      if (entry.isDirectory()) {
        if (current.depth < maxDepth) stack.push({ directory: childPath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile() || getExtension(entry.name) !== ".pdf") continue;
      files.push(toDisplayPath(childPath));
      if (files.length >= maxFiles) {
        truncated = true;
        break;
      }
    }
  }

  files.sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
  return { rootPath, files, errors, truncated, maxFiles, maxDepth };
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
  isWindowsStylePath,
  toDisplayPath,
  toLongPath,
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
  listPdfFilesRecursive,
  sanitizeFileName
};