/* =========================================================
Nombre completo: ids.js
Ruta o ubicación: /src/utils/ids.js
Función o funciones:
- Generar identificadores estables para documentos y filas.
- Extraer registro y periodo de códigos RGI1 y RGI2.
========================================================= */
"use strict";

const crypto = require("crypto");
const path = require("path");
function safeText(value) { return String(value ?? "").trim(); }
function normalizeForId(value) {
  return safeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function shortHash(value, length = 10) {
  return crypto.createHash("sha1").update(safeText(value), "utf8").digest("hex").slice(0, length);
}
function extractRegistroFromCodigo(code) {
  const match = safeText(code).replace(/\s+/g, "").match(/(?:UGPA|CGC)-(?:RGI1|RGI2)-(\d{1,3})-PRO/i);
  return match ? match[1].padStart(2, "0") : "";
}
function extractPeriodoFromCodigo(code) {
  const match = safeText(code).replace(/\s+/g, "").match(/PRO-?\d{1,3}-(\d{4})-(\d{2})/i);
  return match ? `${match[1]}-${match[2]}` : "";
}
function createDocumentId(filePath, index = 0, code = "") {
  const fileName = path.basename(safeText(filePath));
  const prefix = normalizeForId(code) || normalizeForId(fileName.replace(/\.pdf$/i, "")) || "documento";
  return `doc_${String(index + 1).padStart(4, "0")}_${prefix}_${shortHash(`${filePath}|${index}|${code}`, 8)}`;
}
function createRowId(tablePrefix, documentId, index = 0, extra = "") {
  const prefix = normalizeForId(tablePrefix || "fila") || "fila";
  const documentPart = normalizeForId(documentId || "documento").slice(0, 50);
  return `${prefix}_${String(index + 1).padStart(4, "0")}_${documentPart}_${shortHash(`${prefix}|${documentId}|${index}|${extra}`, 8)}`;
}
function createSimpleId(prefix, index = 0, seed = "") {
  const clean = normalizeForId(prefix || "id") || "id";
  return `${clean}_${String(index + 1).padStart(4, "0")}_${shortHash(`${clean}|${index}|${seed}`, 8)}`;
}
module.exports = { safeText, normalizeForId, shortHash, extractRegistroFromCodigo, extractPeriodoFromCodigo, createDocumentId, createRowId, createSimpleId };
