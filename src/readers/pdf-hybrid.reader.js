/* =========================================================
Nombre completo: pdf-hybrid.reader.js
Ruta o ubicación: /src/readers/pdf-hybrid.reader.js
Función o funciones:
- Intentar primero extracción digital rápida.
- Aplicar OCR automáticamente cuando el texto no sea suficiente.
- Entregar un resultado uniforme para los tres tipos documentales.
========================================================= */
"use strict";

const { readPdfFile } = require("../extractor/pdf.reader");
const { readPdfWithOcr } = require("../ocr");
const { assessTextQuality } = require("./text-quality");

function mergeMessages(...collections) {
  return collections.flatMap((items) => Array.isArray(items) ? items : []).filter(Boolean);
}

async function readPdfHybrid(filePath, index = 0, options = {}) {
  const digital = await readPdfFile(filePath, index);
  const quality = assessTextQuality(digital.text, options.quality || {});

  if (digital.ok && quality.sufficient) {
    return {
      ...digital,
      extractionMethod: "digital",
      digitalPageCount: digital.pageCount || 0,
      ocrPageCount: 0,
      ocrConfidence: 0,
      textQuality: quality
    };
  }

  if (typeof options.onModeChange === "function") {
    options.onModeChange({
      index,
      filePath,
      mode: "ocr",
      reasons: quality.reasons
    });
  }

  const ocr = await readPdfWithOcr(filePath, {
    ...(options.ocr || {}),
    index,
    onProgress: options.onProgress,
    onPageStart: options.onPageStart,
    onPageRender: options.onPageRender
  });

  if (ocr.ok) {
    return {
      ...ocr,
      info: digital.info || {},
      metadata: { ...(digital.metadata || {}), ...(ocr.metadata || {}) },
      extractionMethod: digital.text ? "mixed" : "ocr",
      digitalPageCount: digital.text ? digital.pageCount || 0 : 0,
      textQuality: assessTextQuality(ocr.text, options.quality || {}),
      warnings: mergeMessages(
        digital.warnings,
        quality.reasons.map((reason) => `OCR activado: ${reason}`),
        ocr.warnings
      )
    };
  }

  return {
    ...digital,
    extractionMethod: digital.text ? "digital-insufficient" : "failed",
    digitalPageCount: digital.text ? digital.pageCount || 0 : 0,
    ocrPageCount: ocr.ocrPageCount || 0,
    ocrConfidence: ocr.ocrConfidence || 0,
    pages: ocr.pages || [],
    textQuality: quality,
    ok: Boolean(digital.text),
    errors: mergeMessages(digital.errors, ocr.errors),
    warnings: mergeMessages(digital.warnings, quality.reasons, ocr.warnings)
  };
}

async function readPdfFilesHybrid(filePaths, options = {}) {
  const paths = Array.isArray(filePaths) ? filePaths : [];
  const documents = [];

  for (let index = 0; index < paths.length; index += 1) {
    if (typeof options.onDocumentStart === "function") {
      options.onDocumentStart(index + 1, paths.length, paths[index]);
    }
    documents.push(await readPdfHybrid(paths[index], index, options));
  }

  return {
    total: documents.length,
    okCount: documents.filter((document) => document.ok).length,
    errorCount: documents.filter((document) => !document.ok).length,
    digitalCount: documents.filter((document) => document.extractionMethod === "digital").length,
    ocrCount: documents.filter((document) => document.extractionMethod === "ocr").length,
    mixedCount: documents.filter((document) => document.extractionMethod === "mixed").length,
    documents
  };
}

module.exports = {
  mergeMessages,
  readPdfHybrid,
  readPdfFilesHybrid
};
