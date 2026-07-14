/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/ocr/index.js
Función o funciones:
- Coordinar conversión de PDF y reconocimiento OCR.
- Entregar un resultado compatible con el lector digital.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");
const { calculateBufferHash } = require("../utils/hash.utils");
const { renderPdfPages } = require("./pdf-image.service");
const { recognizeRenderedPages } = require("./ocr.service");

async function readPdfWithOcr(filePath, options = {}) {
  const cleanPath = String(filePath || "").trim();
  const output = {
    index: Number(options.index || 0),
    filePath: cleanPath,
    fileName: cleanPath ? path.basename(cleanPath) : "",
    extension: cleanPath ? path.extname(cleanPath).toLowerCase() : "",
    sizeBytes: 0,
    fileHash: "",
    pageCount: 0,
    digitalPageCount: 0,
    ocrPageCount: 0,
    ocrConfidence: 0,
    extractionMethod: "ocr",
    text: "",
    pages: [],
    info: {},
    metadata: {},
    ok: false,
    errors: [],
    warnings: []
  };

  if (!cleanPath || !fs.existsSync(cleanPath)) {
    output.errors.push("El archivo PDF no existe.");
    return output;
  }

  try {
    const buffer = await fs.promises.readFile(cleanPath);
    output.sizeBytes = buffer.length;
    output.fileHash = calculateBufferHash(buffer);

    const renderResult = await renderPdfPages(cleanPath, options);
    const recognition = await recognizeRenderedPages(renderResult, options);

    output.pageCount = renderResult.totalPages || renderResult.renderedPages;
    output.ocrPageCount = recognition.pages.length;
    output.ocrConfidence = recognition.averageConfidence;
    output.text = recognition.text;
    output.pages = recognition.pages;
    output.ok = Boolean(output.text);
    output.metadata = {
      ocr_pages: recognition.pages.map((page) => ({
        page_number: page.pageNumber,
        confidence: page.confidence,
        text_length: page.textLength
      }))
    };

    if (renderResult.truncated) {
      output.warnings.push(`El OCR se limitó a ${renderResult.renderedPages} de ${renderResult.totalPages} páginas.`);
    }
    if (!output.text) output.errors.push("El OCR terminó sin reconocer texto.");
    if (output.ocrConfidence > 0 && output.ocrConfidence < 55) {
      output.warnings.push(`La confianza promedio del OCR es baja: ${output.ocrConfidence}%.`);
    }
  } catch (error) {
    output.errors.push(`Error durante OCR: ${error.message}`);
  }

  return output;
}

module.exports = {
  ...require("./image-preprocessor.service"),
  ...require("./pdf-image.service"),
  ...require("./ocr.service"),
  readPdfWithOcr
};
