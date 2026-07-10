/* =========================================================
Nombre completo: pdf-hybrid.reader.js
Ruta o ubicación: /src/readers/pdf-hybrid.reader.js
Función o funciones:
- Intentar primero la extracción rápida de texto digital.
- Evaluar automáticamente la calidad del texto obtenido.
- Activar OCR solo cuando el PDF esté escaneado o sea ilegible.
- Entregar resultados uniformes para el pipeline documental.
========================================================= */

"use strict";

const { readPdfFile } = require("../extractor/pdf.reader");
const { readPdfWithOcr } = require("./pdf-ocr.reader");
const { assessTextQuality } = require("./text-quality");

function mergeWarnings(...collections) {
  return collections
    .flatMap((items) => Array.isArray(items) ? items : [])
    .filter(Boolean);
}

async function readPdfHybrid(filePath, index = 0, options = {}) {
  const digital = await readPdfFile(filePath, index);
  const quality = assessTextQuality(digital.text, options.quality || {});

  if (digital.ok && quality.sufficient) {
    return {
      ...digital,
      extractionMethod: "digital",
      ocrPageCount: 0,
      ocrConfidence: 0,
      textQuality: quality
    };
  }

  const ocr = await readPdfWithOcr(filePath, {
    ...options.ocr,
    index,
    onProgress: options.onProgress,
    onPageStart: options.onPageStart
  });

  if (ocr.ok) {
    return {
      ...ocr,
      info: digital.info || {},
      metadata: {
        ...(digital.metadata || {}),
        ...(ocr.metadata || {})
      },
      extractionMethod: "ocr",
      textQuality: assessTextQuality(ocr.text, options.quality || {}),
      warnings: mergeWarnings(
        digital.warnings,
        quality.reasons.map((reason) => `OCR activado: ${reason}`),
        ocr.warnings
      )
    };
  }

  return {
    ...digital,
    extractionMethod: digital.text ? "digital-insufficient" : "failed",
    ocrPageCount: ocr.ocrPageCount || 0,
    ocrConfidence: ocr.ocrConfidence || 0,
    textQuality: quality,
    ok: Boolean(digital.text),
    errors: mergeWarnings(digital.errors, ocr.errors),
    warnings: mergeWarnings(
      digital.warnings,
      quality.reasons,
      ocr.warnings,
      ["No fue posible completar el OCR; se conservará el texto digital disponible."]
    )
  };
}

async function readPdfFilesHybrid(filePaths, options = {}) {
  const paths = Array.isArray(filePaths) ? filePaths : [];
  const documents = [];

  for (let index = 0; index < paths.length; index += 1) {
    const document = await readPdfHybrid(paths[index], index, options);
    documents.push(document);
  }

  return {
    total: documents.length,
    okCount: documents.filter((document) => document.ok).length,
    errorCount: documents.filter((document) => !document.ok).length,
    digitalCount: documents.filter((document) => document.extractionMethod === "digital").length,
    ocrCount: documents.filter((document) => document.extractionMethod === "ocr").length,
    documents
  };
}

module.exports = {
  mergeWarnings,
  readPdfHybrid,
  readPdfFilesHybrid
};
