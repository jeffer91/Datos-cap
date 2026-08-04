"use strict";

const fs = require("fs");
const pdfParse = require("pdf-parse");
const { pdf } = require("pdf-to-img");
const { createWorker } = require("tesseract.js");

function assessDigitalText(text) {
  const source = String(text || "");
  const compact = source.replace(/\s+/g, " ").trim();
  const markers = [
    /PLAN\s+INDIVIDUAL/i,
    /DOCENTE/i,
    /CARRERA/i,
    /Capacidades\s+actuales/i,
    /Resumen\s+de\s+Capacitaci[oó]n/i,
    /Impacto\s+esperado/i
  ];
  const markerCount = markers.filter((marker) => marker.test(compact)).length;
  return {
    good: compact.length >= 900 && markerCount >= 3,
    characters: compact.length,
    markerCount
  };
}

class HybridPdfReader {
  constructor(options = {}) {
    this.maxOcrPages = Math.max(1, Number(options.maxOcrPages || 15));
    this.ocrScale = Math.max(1.4, Number(options.ocrScale || 2.2));
    this.worker = null;
    this.workerLanguage = "";
  }

  async ensureWorker(onProgress) {
    if (this.worker) return this.worker;
    const logger = (message) => {
      if (typeof onProgress === "function" && Number.isFinite(message?.progress)) {
        onProgress({ phase: "ocr-progress", percent: Math.round(message.progress * 100), message: message.status || "OCR" });
      }
    };
    try {
      this.worker = await createWorker("spa", undefined, { logger });
      this.workerLanguage = "spa";
    } catch (_error) {
      this.worker = await createWorker("eng", undefined, { logger });
      this.workerLanguage = "eng";
    }
    return this.worker;
  }

  async readDigital(filePath) {
    const buffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(buffer);
    return {
      text: String(parsed.text || ""),
      pages: Number(parsed.numpages || 0),
      info: parsed.info || {}
    };
  }

  async readOcr(filePath, onProgress) {
    const worker = await this.ensureWorker(onProgress);
    const pages = [];
    let pageNumber = 0;
    const rendered = await pdf(filePath, { scale: this.ocrScale });
    for await (const image of rendered) {
      pageNumber += 1;
      if (pageNumber > this.maxOcrPages) break;
      if (typeof onProgress === "function") {
        onProgress({ phase: "ocr-page", page: pageNumber, message: `OCR página ${pageNumber}` });
      }
      const result = await worker.recognize(image);
      pages.push({
        page: pageNumber,
        text: String(result?.data?.text || ""),
        confidence: Number(result?.data?.confidence || 0)
      });
    }
    return {
      text: pages.map((item) => item.text).join("\n\n"),
      pages: pageNumber,
      ocrPages: pages,
      language: this.workerLanguage
    };
  }

  async read(filePath, onProgress) {
    let digital = { text: "", pages: 0, info: {} };
    let digitalError = "";
    try {
      digital = await this.readDigital(filePath);
    } catch (error) {
      digitalError = error.message;
    }
    const quality = assessDigitalText(digital.text);
    if (quality.good) {
      return {
        text: digital.text,
        pages: digital.pages,
        method: "DIGITAL",
        quality,
        warnings: []
      };
    }

    if (typeof onProgress === "function") {
      onProgress({ phase: "ocr-start", message: "PDF escaneado: iniciando OCR" });
    }
    const ocr = await this.readOcr(filePath, onProgress);
    const ocrQuality = assessDigitalText(ocr.text);
    const combined = [digital.text, ocr.text].filter(Boolean).join("\n\n");
    return {
      text: combined,
      pages: Math.max(digital.pages, ocr.pages),
      method: digital.text.trim() ? "MIXTO" : "OCR",
      quality: ocrQuality,
      ocrPages: ocr.ocrPages,
      warnings: [
        digitalError ? `Lectura digital: ${digitalError}` : "El texto digital era insuficiente.",
        !ocrQuality.good ? "El OCR no reconoció todos los encabezados esperados." : ""
      ].filter(Boolean)
    };
  }

  async close() {
    if (!this.worker) return;
    await this.worker.terminate();
    this.worker = null;
    this.workerLanguage = "";
  }
}

module.exports = { assessDigitalText, HybridPdfReader };
