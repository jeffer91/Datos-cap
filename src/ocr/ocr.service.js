/* =========================================================
Nombre completo: ocr.service.js
Ruta o ubicación: /src/ocr/ocr.service.js
Función o funciones:
- Ejecutar OCR local con Tesseract.js en español e inglés.
- Procesar páginas secuencialmente y reportar progreso.
- Devolver texto y confianza por página.
========================================================= */
"use strict";

const { normalizeLineBreaks } = require("../extractor/normalizer");
const { preprocessImage } = require("./image-preprocessor.service");

function loadTesseract() {
  try {
    return require("tesseract.js");
  } catch (error) {
    throw new Error(`No se pudo cargar el motor OCR: ${error.message}`);
  }
}

async function createOcrWorker(options = {}) {
  const { createWorker } = loadTesseract();
  const languages = options.languages || ["spa", "eng"];
  const logger = typeof options.onProgress === "function"
    ? (message) => options.onProgress(message)
    : undefined;

  return createWorker(languages, undefined, { logger });
}

async function recognizeRenderedPages(renderResult, options = {}) {
  const worker = options.worker || await createOcrWorker(options);
  const ownsWorker = !options.worker;
  const pageResults = [];

  try {
    for (const page of renderResult.pages || []) {
      if (typeof options.onPageStart === "function") {
        options.onPageStart(page.pageNumber, renderResult.totalPages || renderResult.renderedPages);
      }

      const image = await preprocessImage(page.image, options.preprocessing || {});
      const recognition = await worker.recognize(image);
      const data = recognition && recognition.data ? recognition.data : {};
      const text = normalizeLineBreaks(data.text || "");
      const confidence = Number.isFinite(data.confidence)
        ? Number(data.confidence.toFixed(2))
        : 0;

      pageResults.push({
        pageNumber: page.pageNumber,
        text,
        confidence,
        textLength: text.length
      });
    }
  } finally {
    if (ownsWorker && worker && typeof worker.terminate === "function") {
      await worker.terminate();
    }
  }

  const confidences = pageResults
    .map((page) => page.confidence)
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0;

  return {
    pages: pageResults,
    text: normalizeLineBreaks(pageResults.map((page) => page.text).filter(Boolean).join("\n\n")),
    averageConfidence: Number(averageConfidence.toFixed(2))
  };
}

module.exports = {
  loadTesseract,
  createOcrWorker,
  recognizeRenderedPages
};
