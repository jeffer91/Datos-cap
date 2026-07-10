/* =========================================================
Nombre completo: pdf-ocr.reader.js
Ruta o ubicación: /src/readers/pdf-ocr.reader.js
Función o funciones:
- Convertir páginas PDF escaneadas en imágenes PNG.
- Ejecutar OCR en español e inglés mediante Tesseract.js.
- Devolver texto, confianza, páginas procesadas y advertencias.
- Liberar correctamente trabajadores OCR y recursos del PDF.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeLineBreaks } = require("../extractor/normalizer");
const { calculateBufferHash } = require("../utils/hash.utils");

async function loadPdfRenderer() {
  try {
    return await import("pdf-to-img");
  } catch (error) {
    throw new Error(`No se pudo cargar el convertidor PDF a imagen: ${error.message}`);
  }
}

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

async function renderPdfPages(filePath, options = {}) {
  const { pdf } = await loadPdfRenderer();
  const scale = Number.isFinite(options.scale) ? options.scale : 2.2;
  const maxPages = Number.isFinite(options.maxPages) ? options.maxPages : 40;
  const document = await pdf(filePath, { scale });
  const pages = [];

  try {
    const totalPages = Number(document.length || 0);
    const limit = Math.min(totalPages || maxPages, maxPages);

    for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
      const image = await document.getPage(pageNumber);
      pages.push({
        pageNumber,
        image
      });
    }

    return {
      totalPages,
      renderedPages: pages.length,
      truncated: totalPages > pages.length,
      pages
    };
  } finally {
    if (document && typeof document.destroy === "function") {
      await document.destroy();
    }
  }
}

async function recognizePages(renderResult, options = {}) {
  const worker = options.worker || await createOcrWorker(options);
  const ownsWorker = !options.worker;
  const pageResults = [];

  try {
    for (const page of renderResult.pages || []) {
      if (typeof options.onPageStart === "function") {
        options.onPageStart(page.pageNumber, renderResult.totalPages);
      }

      const recognition = await worker.recognize(page.image);
      const data = recognition && recognition.data ? recognition.data : {};
      const text = normalizeLineBreaks(data.text || "");

      pageResults.push({
        pageNumber: page.pageNumber,
        text,
        confidence: Number.isFinite(data.confidence) ? Number(data.confidence.toFixed(2)) : 0
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
    ocrPageCount: 0,
    ocrConfidence: 0,
    extractionMethod: "ocr",
    text: "",
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
    const recognition = await recognizePages(renderResult, options);

    output.pageCount = renderResult.totalPages || renderResult.renderedPages;
    output.ocrPageCount = recognition.pages.length;
    output.ocrConfidence = recognition.averageConfidence;
    output.text = recognition.text;
    output.ok = Boolean(output.text);
    output.metadata = {
      ocr_pages: recognition.pages.map((page) => ({
        page_number: page.pageNumber,
        confidence: page.confidence,
        text_length: page.text.length
      }))
    };

    if (renderResult.truncated) {
      output.warnings.push(`El OCR se limitó a ${renderResult.renderedPages} de ${renderResult.totalPages} páginas.`);
    }

    if (!output.text) {
      output.errors.push("El OCR terminó sin reconocer texto.");
    }

    if (output.ocrConfidence > 0 && output.ocrConfidence < 55) {
      output.warnings.push(`La confianza promedio del OCR es baja: ${output.ocrConfidence}%.`);
    }
  } catch (error) {
    output.errors.push(`Error durante OCR: ${error.message}`);
  }

  return output;
}

module.exports = {
  loadPdfRenderer,
  loadTesseract,
  createOcrWorker,
  renderPdfPages,
  recognizePages,
  readPdfWithOcr
};
