/* =========================================================
Nombre completo: ids.js
Ruta o ubicación: /src/utils/ids.js
Función o funciones:
- Generar identificadores únicos y estables para documentos y filas.
- Usar hash de contenido para que la ruta y el orden no cambien la identidad.
- Extraer registro y periodo desde códigos institucionales UGPA o CGC.
========================================================= */

"use strict";

const crypto = require("crypto");
const path = require("path");
const { calculateFileHash } = require("./hash.utils");

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeForId(value) {
  return safeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function shortHash(value, length = 10) {
  const size = Number.isFinite(length) && length > 0 ? length : 10;
  return crypto.createHash("sha1").update(safeText(value), "utf8").digest("hex").slice(0, size);
}

function extractRegistroFromCodigo(codigoDocumento) {
  const text = safeText(codigoDocumento).replace(/\s+/g, "");
  const match = text.match(/(?:UGPA|CGC)-(?:RGI1|RGI2|INF|RI\d+)-(\d{1,3})-PRO/i);
  return match ? match[1].padStart(2, "0") : "";
}

function extractPeriodoFromCodigo(codigoDocumento) {
  const text = safeText(codigoDocumento).replace(/\s+/g, "");
  const match = text.match(/PRO-?\d{1,3}-(\d{4})-(\d{2})/i);
  return match ? `${match[1]}-${match[2]}` : "";
}

function createDocumentId(filePath, index = 0, codigoDocumento = "", fileHash = "", documentType = "") {
  const cleanPath = safeText(filePath);
  const fileName = path.basename(cleanPath);
  const baseName = normalizeForId(fileName.replace(/\.pdf$/i, ""));
  const codePart = normalizeForId(codigoDocumento);
  const typePart = normalizeForId(documentType || "documento");
  const resolvedFileHash = safeText(fileHash) || calculateFileHash(cleanPath);
  const stableHash = normalizeForId(resolvedFileHash);
  const seed = stableHash
    ? `${typePart}|${stableHash}|${codigoDocumento}`
    : `${typePart}|${cleanPath}|${index}|${codigoDocumento}`;
  const hash = shortHash(seed, 12);
  const prefix = codePart || baseName || typePart || "documento";

  return `doc_${typePart}_${prefix}_${hash}`;
}

function createRowId(tablePrefix, documentId, index = 0, extra = "") {
  const prefix = normalizeForId(tablePrefix || "fila") || "fila";
  const documentPart = normalizeForId(documentId || "documento").slice(0, 50);
  const hash = shortHash(`${prefix}|${documentId}|${index}|${extra}`, 8);
  return `${prefix}_${String(index + 1).padStart(4, "0")}_${documentPart}_${hash}`;
}

function createSimpleId(prefix, index = 0, seed = "") {
  const cleanPrefix = normalizeForId(prefix || "id") || "id";
  const hash = shortHash(`${cleanPrefix}|${index}|${seed}`, 8);
  return `${cleanPrefix}_${String(index + 1).padStart(4, "0")}_${hash}`;
}

module.exports = {
  safeText,
  normalizeForId,
  shortHash,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo,
  createDocumentId,
  createRowId,
  createSimpleId
};
