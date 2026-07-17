/* =========================================================
Nombre completo: hash.utils.js
Ruta o ubicación: /src/utils/hash.utils.js
Función o funciones:
- Calcular huellas SHA-256 desde archivos y buffers.
- Detectar documentos repetidos aunque cambien de nombre o ubicación.
- Leer archivos ubicados en rutas largas de Windows.
========================================================= */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const { toLongPath } = require("./file.utils");

function calculateBufferHash(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return "";
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function calculateFileHash(filePath) {
  const cleanPath = String(filePath || "").trim();
  const nativePath = toLongPath(cleanPath);
  if (!nativePath || !fs.existsSync(nativePath)) return "";
  const stat = fs.statSync(nativePath);
  if (!stat.isFile()) return "";
  return calculateBufferHash(fs.readFileSync(nativePath));
}

module.exports = {
  calculateBufferHash,
  calculateFileHash
};