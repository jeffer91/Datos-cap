/* =========================================================
Nombre completo: ids.js
Ruta o ubicación: /plan-docente-extractor/src/utils/ids.js
Función o funciones:
- Generar identificadores únicos y estables para documentos y filas.
- Crear IDs independientes para tablas no relacionales.
- Extraer registro y periodo desde el código documental.
- Normalizar textos usados en claves internas.
========================================================= */

"use strict";

const crypto = require("crypto");
const path = require("path");

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

  return crypto
    .createHash("sha1")
    .update(safeText(value), "utf8")
    .digest("hex")
    .slice(0, size);
}

function extractRegistroFromCodigo(codigoDocumento) {
  const text = safeText(codigoDocumento).replace(/\s+/g, "");
  const match = text.match(/UGPA-RGI1-(\d{1,3})-PRO/i);
  return match ? match[1].padStart(2, "0") : "";
}

function extractPeriodoFromCodigo(codigoDocumento) {
  const text = safeText(codigoDocumento).replace(/\s+/g, "");
  const match = text.match(/PRO-?251-(\d{4})-(\d{2})/i);

  if (!match) {
    return "";
  }

  return `${match[1]}-${match[2]}`;
}

function createDocumentId(filePath, index = 0, codigoDocumento = "") {
  const fileName = path.basename(safeText(filePath));
  const baseName = normalizeForId(fileName.replace(/\.pdf$/i, ""));
  const codePart = normalizeForId(codigoDocumento);
  const hash = shortHash(`${filePath}|${index}|${codigoDocumento}`, 8);
  const prefix = codePart || baseName || "documento";

  return `doc_${String(index + 1).padStart(4, "0")}_${prefix}_${hash}`;
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
