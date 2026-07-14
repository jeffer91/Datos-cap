/* =========================================================
Nombre completo: hash.utils.js
Ruta o ubicación: /src/utils/hash.utils.js
Función o funciones:
- Calcular huellas SHA-256 desde archivos y buffers.
- Detectar documentos repetidos aunque cambien de nombre o ubicación.
========================================================= */
"use strict";

const crypto = require("crypto");
const fs = require("fs");

function calculateBufferHash(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return "";
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function calculateFileHash(filePath) {
  const cleanPath = String(filePath || "").trim();
  if (!cleanPath || !fs.existsSync(cleanPath)) return "";
  const stat = fs.statSync(cleanPath);
  if (!stat.isFile()) return "";
  return calculateBufferHash(fs.readFileSync(cleanPath));
}

module.exports = {
  calculateBufferHash,
  calculateFileHash
};
