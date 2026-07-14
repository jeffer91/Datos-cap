/* =========================================================
Nombre completo: pdf.reader.js
Ruta o ubicación: /src/extractor/pdf.reader.js
Función o funciones:
- Leer PDF digitales con pdf-parse.
- Calcular huella SHA-256 y metadatos básicos.
- Mantener un resultado compatible con lectura OCR e híbrida.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { normalizeLineBreaks } = require("./normalizer");
const { calculateBufferHash } = require("../utils/hash.utils");

function createEmptyPdfResult(filePath, index = 0) {
  const cleanPath = String(filePath || "").trim();
  return {
    index,
    filePath: cleanPath,
    fileName: cleanPath ? path.basename(cleanPath) : "",
    extension: cleanPath ? path.extname(cleanPath).toLowerCase() : "",
    sizeBytes: 0,
    fileHash: "",
    pageCount: 0,
    digitalPageCount: 0,
    ocrPageCount: 0,
    ocrConfidence: 0,
    extractionMethod: "digital",
    text: "",
    pages: [],
    info: {},
    metadata: {},
    ok: false,
    errors: [],
    warnings: []
  };
}

function validateReadablePdf(filePath) {
  const result = { ok: false, sizeBytes: 0, errors: [] };
  const cleanPath = String(filePath || "").trim();
  if (!cleanPath) { result.errors.push("Ruta vacía."); return result; }
  if (!fs.existsSync(cleanPath)) { result.errors.push("El archivo no existe."); return result; }
  if (path.extname(cleanPath).toLowerCase() !== ".pdf") {
    result.errors.push("El archivo no tiene extensión PDF.");
    return result;
  }

  try {
    const stat = fs.statSync(cleanPath);
    if (!stat.isFile()) result.errors.push("La ruta no corresponde a un archivo.");
    if (stat.size <= 0) result.errors.push("El PDF está vacío.");
    if (!result.errors.length) {
      result.ok = true;
      result.sizeBytes = stat.size;
    }
  } catch (error) {
    result.errors.push(`No se pudo leer el archivo: ${error.message}`);
  }
  return result;
}

async function readPdfFile(filePath, index = 0) {
  const output = createEmptyPdfResult(filePath, index);
  const validation = validateReadablePdf(filePath);
  output.sizeBytes = validation.sizeBytes;
  if (!validation.ok) {
    output.errors.push(...validation.errors);
    return output;
  }

  try {
    const buffer = await fs.promises.readFile(filePath);
    output.fileHash = calculateBufferHash(buffer);
    const parsed = await pdfParse(buffer);
    const text = normalizeLineBreaks(parsed.text || "");
    output.pageCount = Number(parsed.numpages || 0);
    output.digitalPageCount = text ? output.pageCount : 0;
    output.text = text;
    output.info = parsed.info || {};
    output.metadata = parsed.metadata || {};
    output.ok = Boolean(text);
    if (!text) output.errors.push("No se pudo extraer texto digital. El PDF puede requerir OCR.");
    if (!output.pageCount) output.warnings.push("No se detectó número de páginas.");
  } catch (error) {
    output.errors.push(`Error al procesar PDF: ${error.message}`);
  }
  return output;
}

async function readPdfFiles(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [];
  const documents = [];
  for (let index = 0; index < paths.length; index += 1) {
    documents.push(await readPdfFile(paths[index], index));
  }
  return {
    total: documents.length,
    okCount: documents.filter((item) => item.ok).length,
    errorCount: documents.filter((item) => !item.ok).length,
    documents
  };
}

module.exports = {
  createEmptyPdfResult,
  validateReadablePdf,
  readPdfFile,
  readPdfFiles
};
