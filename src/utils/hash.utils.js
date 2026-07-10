/* =========================================================
Nombre completo: hash.utils.js
Ruta o ubicación: /src/utils/hash.utils.js
Función o funciones:
- Calcular hash SHA-256 de archivos locales.
- Crear claves estables para detectar documentos duplicados.
- Evitar que una ruta o el orden de selección cambien la identidad del PDF.
========================================================= */

"use strict";

const crypto = require("crypto");
const fs = require("fs");

function calculateBufferHash(buffer, algorithm = "sha256") {
  return crypto.createHash(algorithm).update(buffer).digest("hex");
}

function calculateFileHash(filePath, algorithm = "sha256") {
  const cleanPath = String(filePath || "").trim();

  if (!cleanPath || !fs.existsSync(cleanPath)) {
    return "";
  }

  try {
    return calculateBufferHash(fs.readFileSync(cleanPath), algorithm);
  } catch (error) {
    return "";
  }
}

function createDocumentFingerprint(options) {
  const config = options || {};
  const parts = [
    String(config.documentType || "").trim().toLowerCase(),
    String(config.fileHash || "").trim().toLowerCase(),
    String(config.codigoDocumento || "").trim().toLowerCase(),
    String(config.periodo || "").trim().toLowerCase()
  ].filter(Boolean);

  return calculateBufferHash(Buffer.from(parts.join("|"), "utf8"));
}

module.exports = {
  calculateBufferHash,
  calculateFileHash,
  createDocumentFingerprint
};
