"use strict";

const fs = require("fs");
const pdfParse = require("pdf-parse");
const { createWorker } = require("tesseract.js");

let pdfRendererPromise = null;

async function getPdfRenderer() {
  if (!pdfRendererPromise) {
    pdfRendererPromise = import("pdf-to-img")
      .then((module) => {
        if (typeof module?.pdf !== "function") {
          throw new Error("pdf-to-img no expuso la función pdf esperada.");
        }
        return module.pdf;
      })
      .catch((error) => {
        pdfRendererPromise = null;
        throw error;
      });
  }
  return pdfRendererPromise;
}

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

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function imageDimensions(image) {
  const buffer = Buffer.isBuffer(image) ? image : Buffer.from(image || []);
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return { width: 0, height: 0 };
}

function clampRectangle(rectangle, dimensions) {
  const width = Math.max(1, Number(dimensions.width || 0));
  const height = Math.max(1, Number(dimensions.height || 0));
  const left = Math.max(0, Math.min(width - 1, Math.round(rectangle.left || 0)));
  const top = Math.max(0, Math.min(height - 1, Math.round(rectangle.top || 0)));
  const rectWidth = Math.max(1, Math.min(width - left, Math.round(rectangle.width || width)));
  const rectHeight = Math.max(1, Math.min(height - top, Math.round(rectangle.height || height)));
  return { left, top, width: rectWidth, height: rectHeight };
}

function ratioRectangle(dimensions, left, top, width, height) {
  return clampRectangle({
    left: dimensions.width * left,
    top: dimensions.height * top,
    width: dimensions.width * width,
    height: dimensions.height * height
  }, dimensions);
}

function parseTsv(tsv, offset = {}) {
  const source = String(tsv || "").trim();
  if (!source) return [];
  const lines = source.split(/\r?\n/);
  const words = [];
  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split("\t");
    if (columns.length < 12) continue;
    const text = String(columns.slice(11).join("\t") || "").trim();
    const confidence = Number(columns[10]);
    if (!text || !Number.isFinite(confidence) || confidence < -1) continue;
    const left = Number(columns[6] || 0) + Number(offset.left || 0);
    const top = Number(columns[7] || 0) + Number(offset.top || 0);
    const width = Number(columns[8] || 0);
    const height = Number(columns[9] || 0);
    words.push({
      page: Number(columns[1] || 0),
      block: Number(columns[2] || 0),
      paragraph: Number(columns[3] || 0),
      line: Number(columns[4] || 0),
      word: Number(columns[5] || 0),
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      centerX: left + width / 2,
      centerY: top + height / 2,
      confidence,
      text
    });
  }
  return words;
}

function groupWordsIntoLines(words) {
  const groups = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const key = `${word.block}:${word.paragraph}:${word.line}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  });
  return [...groups.values()].map((lineWords) => {
    const sorted = lineWords.sort((left, right) => left.left - right.left);
    return {
      text: sorted.map((word) => word.text).join(" ").replace(/\s+/g, " ").trim(),
      normalized: normalize(sorted.map((word) => word.text).join(" ")),
      left: Math.min(...sorted.map((word) => word.left)),
      top: Math.min(...sorted.map((word) => word.top)),
      right: Math.max(...sorted.map((word) => word.right)),
      bottom: Math.max(...sorted.map((word) => word.bottom)),
      words: sorted
    };
  }).sort((left, right) => left.top - right.top || left.left - right.left);
}

function findLine(lines, matcher, afterTop = -1) {
  return (Array.isArray(lines) ? lines : []).find((line) => line.top > afterTop && matcher(line.normalized, line.text)) || null;
}

function sectionRectangle(lines, dimensions, startMatcher, endMatcher, fallback = null) {
  const start = findLine(lines, startMatcher);
  if (!start) return fallback;
  const end = findLine(lines, endMatcher, start.bottom);
  const top = Math.max(0, start.top - Math.round(dimensions.height * 0.01));
  const bottom = end
    ? Math.min(dimensions.height, end.top + Math.round(dimensions.height * 0.01))
    : Math.min(dimensions.height, start.bottom + Math.round(dimensions.height * 0.46));
  return clampRectangle({
    left: dimensions.width * 0.035,
    top,
    width: dimensions.width * 0.93,
    height: Math.max(80, bottom - top)
  }, dimensions);
}

function looksLikeTablePage(text) {
  const normalized = normalize(text);
  const rangeCount = (normalized.match(/\bdesde\b/g) || []).length;
  const typeCount = (normalized.match(/\baprobacion\b/g) || []).length;
  return normalized.includes("resumen de capacitacion")
    || normalized.includes("capacitacion propuesta")
    || (rangeCount >= 2 && typeCount >= 2);
}

function emptyLayout() {
  return {
    headers: [],
    codeRegions: [],
    tables: [],
    sections: {
      activities: [],
      impact: [],
      vision: []
    }
  };
}

class HybridPdfReader {
  constructor(options = {}) {
    this.maxOcrPages = Math.max(1, Number(options.maxOcrPages || 15));
    this.ocrScale = Math.max(1.4, Number(options.ocrScale || 2.55));
    this.worker = null;
    this.workerLanguage = "";
  }

  async ensureWorker(onProgress) {
    if (this.worker) return this.worker;
    const logger = (message) => {
      if (typeof onProgress === "function" && Number.isFinite(message?.progress)) {
        onProgress({
          phase: "ocr-progress",
          percent: Math.round(message.progress * 100),
          message: message.status || "OCR"
        });
      }
    };
    try {
      this.worker = await createWorker("spa", undefined, { logger });
      this.workerLanguage = "spa";
    } catch (_error) {
      this.worker = await createWorker("eng", undefined, { logger });
      this.workerLanguage = "eng";
    }
    await this.worker.setParameters({
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
      tessedit_pageseg_mode: "3"
    });
    return this.worker;
  }

  async recognize(worker, image, options = {}) {
    const rectangle = options.rectangle || null;
    await worker.setParameters({
      preserve_interword_spaces: options.preserveSpaces === false ? "0" : "1",
      user_defined_dpi: "300",
      tessedit_pageseg_mode: String(options.psm || "3"),
      tessedit_char_whitelist: options.whitelist || ""
    });
    const result = await worker.recognize(
      image,
      rectangle ? { rectangle } : {},
      { text: true, tsv: Boolean(options.tsv) }
    );
    return {
      text: String(result?.data?.text || ""),
      confidence: Number(result?.data?.confidence || 0),
      tsv: String(result?.data?.tsv || "")
    };
  }

  async recognizeRegion(worker, image, dimensions, rectangle, options = {}) {
    const safeRectangle = clampRectangle(rectangle, dimensions);
    const result = await this.recognize(worker, image, {
      ...options,
      rectangle: safeRectangle
    });
    return {
      ...result,
      rectangle: safeRectangle,
      words: options.tsv ? parseTsv(result.tsv, safeRectangle) : []
    };
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

  async analyzePageLayout(worker, image, pageNumber, fullResult, onProgress) {
    const dimensions = imageDimensions(image);
    const layout = {
      header: null,
      codeRegion: null,
      table: null,
      activities: null,
      impact: null,
      vision: null
    };
    if (!dimensions.width || !dimensions.height) return layout;

    const fullWords = parseTsv(fullResult.tsv);
    const lines = groupWordsIntoLines(fullWords);

    if (pageNumber <= 2) {
      if (typeof onProgress === "function") {
        onProgress({ phase: "ocr-region", page: pageNumber, message: `Leyendo encabezado de la página ${pageNumber}` });
      }
      const headerRectangle = ratioRectangle(dimensions, 0.02, 0.015, 0.96, 0.19);
      layout.header = await this.recognizeRegion(worker, image, dimensions, headerRectangle, { psm: "6", tsv: true });

      const codeRectangle = ratioRectangle(dimensions, 0.62, 0.015, 0.36, 0.19);
      const normalCode = await this.recognizeRegion(worker, image, dimensions, codeRectangle, { psm: "6", tsv: true });
      const codeOnly = await this.recognizeRegion(worker, image, dimensions, codeRectangle, {
        psm: "6",
        whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",
        preserveSpaces: false
      });
      layout.codeRegion = {
        ...normalCode,
        text: `${normalCode.text}\n${codeOnly.text}`.trim(),
        codeOnlyText: codeOnly.text
      };
    }

    const tableRectangle = sectionRectangle(
      lines,
      dimensions,
      (normalized) => normalized.includes("resumen") && normalized.includes("capacitacion") && normalized.includes("propuesta"),
      (normalized) => normalized.includes("indicadores"),
      looksLikeTablePage(fullResult.text) ? ratioRectangle(dimensions, 0.035, 0.055, 0.93, 0.58) : null
    );

    if (tableRectangle) {
      if (typeof onProgress === "function") {
        onProgress({ phase: "ocr-region", page: pageNumber, message: `Reconstruyendo tabla de la página ${pageNumber}` });
      }
      layout.table = await this.recognizeRegion(worker, image, dimensions, tableRectangle, {
        psm: "6",
        tsv: true,
        preserveSpaces: true
      });
      layout.table.page = pageNumber;
      layout.table.pageWidth = dimensions.width;
      layout.table.pageHeight = dimensions.height;
    }

    const activitiesRectangle = sectionRectangle(
      lines,
      dimensions,
      (normalized) => /(^| )6 actividades( |$)/.test(normalized) || normalized === "actividades",
      (normalized) => normalized.includes("7 impacto esperado") || normalized.includes("impacto esperado en el docente")
    );
    if (activitiesRectangle) {
      layout.activities = await this.recognizeRegion(worker, image, dimensions, activitiesRectangle, { psm: "6", tsv: true });
      layout.activities.page = pageNumber;
    }

    const impactRectangle = sectionRectangle(
      lines,
      dimensions,
      (normalized) => normalized.includes("impacto esperado en el docente") || normalized.includes("7 impacto esperado"),
      (normalized) => normalized.includes("vision a largo plazo") || normalized.includes("8 vision")
    );
    if (impactRectangle) {
      layout.impact = await this.recognizeRegion(worker, image, dimensions, impactRectangle, { psm: "6" });
      layout.impact.page = pageNumber;
    }

    const visionRectangle = sectionRectangle(
      lines,
      dimensions,
      (normalized) => normalized.includes("vision a largo plazo") || normalized.includes("8 vision"),
      (normalized) => normalized.includes("formacion docente")
    );
    if (visionRectangle) {
      layout.vision = await this.recognizeRegion(worker, image, dimensions, visionRectangle, { psm: "6" });
      layout.vision.page = pageNumber;
    }

    return layout;
  }

  async readOcr(filePath, onProgress) {
    const renderPdf = await getPdfRenderer();
    const worker = await this.ensureWorker(onProgress);
    const pages = [];
    const layout = emptyLayout();
    let pageNumber = 0;
    const rendered = await renderPdf(filePath, { scale: this.ocrScale });

    for await (const rawImage of rendered) {
      pageNumber += 1;
      if (pageNumber > this.maxOcrPages) break;
      const image = Buffer.isBuffer(rawImage) ? rawImage : Buffer.from(rawImage);
      if (typeof onProgress === "function") {
        onProgress({
          phase: "ocr-page",
          page: pageNumber,
          message: `OCR página ${pageNumber}`
        });
      }

      const result = await this.recognize(worker, image, { psm: "3", tsv: true });
      const pageLayout = await this.analyzePageLayout(worker, image, pageNumber, result, onProgress);
      if (pageLayout.header) layout.headers.push({ page: pageNumber, ...pageLayout.header });
      if (pageLayout.codeRegion) layout.codeRegions.push({ page: pageNumber, ...pageLayout.codeRegion });
      if (pageLayout.table) layout.tables.push(pageLayout.table);
      if (pageLayout.activities) layout.sections.activities.push(pageLayout.activities);
      if (pageLayout.impact) layout.sections.impact.push(pageLayout.impact);
      if (pageLayout.vision) layout.sections.vision.push(pageLayout.vision);

      pages.push({
        page: pageNumber,
        text: result.text,
        confidence: result.confidence
      });
    }

    const structuredText = [
      ...layout.headers.map((item) => `ENCABEZADO PÁGINA ${item.page}\n${item.text}`),
      ...layout.codeRegions.map((item) => `CÓDIGO PÁGINA ${item.page}\n${item.text}`),
      ...layout.tables.map((item) => `TABLA DE CAPACITACIONES PÁGINA ${item.page}\n${item.text}`),
      ...layout.sections.activities.map((item) => `ACTIVIDADES PÁGINA ${item.page}\n${item.text}`),
      ...layout.sections.impact.map((item) => `IMPACTO PÁGINA ${item.page}\n${item.text}`),
      ...layout.sections.vision.map((item) => `VISIÓN PÁGINA ${item.page}\n${item.text}`)
    ].join("\n\n");

    return {
      text: [pages.map((item) => item.text).join("\n\n"), structuredText].filter(Boolean).join("\n\n"),
      pages: pageNumber,
      ocrPages: pages,
      language: this.workerLanguage,
      layout
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
        layout: emptyLayout(),
        warnings: []
      };
    }

    if (typeof onProgress === "function") {
      onProgress({ phase: "ocr-start", message: "PDF escaneado: iniciando OCR inteligente" });
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
      layout: ocr.layout,
      warnings: [
        digitalError ? `Lectura digital: ${digitalError}` : "El texto digital era insuficiente.",
        "Se aplicó OCR por regiones para encabezados, tablas y secciones.",
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

module.exports = {
  assessDigitalText,
  imageDimensions,
  parseTsv,
  groupWordsIntoLines,
  sectionRectangle,
  getPdfRenderer,
  HybridPdfReader
};
