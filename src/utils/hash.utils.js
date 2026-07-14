/* =========================================================
Nombre completo: hash.utils.js
Ruta o ubicación: /src/utils/hash.utils.js
Función o funciones:
- Calcular la huella SHA-256 de archivos locales.
- Permitir detectar PDF repetidos aunque cambien de nombre o carpeta.
========================================================= */
"use strict";

const crypto = require("crypto");
const fs = require("fs");

function calculateFileHash(filePath) {
  const cleanPath = String(filePath || "").trim();
  if (!cleanPath || !fs.existsSync(cleanPath)) return "";
  const stat = fs.statSync(cleanPath);
  if (!stat.isFile()) return "";
  return crypto.createHash("sha256").update(fs.readFileSync(cleanPath)).digest("hex");
}

module.exports = { calculateFileHash };
