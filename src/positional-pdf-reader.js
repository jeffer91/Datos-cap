"use strict";

const fs = require("fs");

let pdfJs = null;

function getPdfJs() {
  if (!pdfJs) {
    pdfJs = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
  }
  return pdfJs;
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalize(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function splitTextItem(item, pageNumber, pageHeight) {
  const text = clean(item?.str);
  if (!text) return [];
  const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 10, 0, 0];
  const x = Number(transform[4] || 0);
  const rawHeight = Math.abs(Number(item.height || transform[3] || 10));
  const height = Math.max(5, rawHeight);
  const baseline = Number(transform[5] || 0);
  const top = Math.max(0, pageHeight - baseline - height);
  const totalWidth = Math.max(Number(item.width || 0), text.length * Math.max(3, height * 0.38));
  const parts = text.split(/\s+/).filter(Boolean);
  const characters = Math.max(1, parts.reduce((sum, part) => sum + part.length, 0) + Math.max(0, parts.length - 1));
  let cursor = x;

  return parts.map((part, index) => {
    const ratio = Math.max(1, part.length) / characters;
    const width = index === parts.length - 1
      ? Math.max(2, x + totalWidth - cursor)
      : Math.max(2, totalWidth * ratio);
    const word = {
      page: pageNumber,
      block: 0,
      paragraph: 0,
      line: 0,
      word: index + 1,
      left: cursor,
      top,
      width,
      height,
      right: cursor + width,
      bottom: top + height,
      centerX: cursor + width / 2,
      centerY: top + height / 2,
      confidence: 100,
      text: part,
      source: "PDFJS"
    };
    cursor += width + Math.max(1.5, height * 0.18);
    return word;
  });
}

function groupWordsIntoLines(words) {
  const sorted = [...(Array.isArray(words) ? words : [])]
    .filter((word) => clean(word.text))
    .sort((left, right) => left.centerY - right.centerY || left.left - right.left);
  const lines = [];

  for (const word of sorted) {
    const tolerance = Math.max(2.5, Math.min(7, Number(word.height || 10) * 0.55));
    let line = lines.find((candidate) => Math.abs(candidate.centerY - word.centerY) <= tolerance);
    if (!line) {
      line = { centerY: word.centerY, words: [] };
      lines.push(line);
    }
    line.words.push(word);
    line.centerY = line.words.reduce((sum, item) => sum + item.centerY, 0) / line.words.length;
  }

  return lines
    .sort((left, right) => left.centerY - right.centerY)
    .map((line, lineIndex) => {
      const lineWords = line.words.sort((left, right) => left.left - right.left)
        .map((word, wordIndex) => ({ ...word, line: lineIndex + 1, word: wordIndex + 1 }));
      const text = lineWords.map((word) => word.text).join(" ").replace(/\s+/g, " ").trim();
      return {
        text,
        normalized: normalize(text),
        left: Math.min(...lineWords.map((word) => word.left)),
        top: Math.min(...lineWords.map((word) => word.top)),
        right: Math.max(...lineWords.map((word) => word.right)),
        bottom: Math.max(...lineWords.map((word) => word.bottom)),
        centerY: line.centerY,
        words: lineWords
      };
    });
}

function wordsInside(words, rectangle) {
  const right = rectangle.left + rectangle.width;
  const bottom = rectangle.top + rectangle.height;
  return (Array.isArray(words) ? words : []).filter((word) =>
    word.centerX >= rectangle.left
    && word.centerX <= right
    && word.centerY >= rectangle.top
    && word.centerY <= bottom
  );
}

function regionText(words) {
  return groupWordsIntoLines(words).map((line) => line.text).filter(Boolean).join("\n");
}

function makeRegion(words, rectangle, pageNumber, pageWidth, pageHeight) {
  const selected = wordsInside(words, rectangle);
  return {
    page: pageNumber,
    pageWidth,
    pageHeight,
    rectangle,
    words: selected,
    text: regionText(selected),
    confidence: 100,
    source: "PDFJS_POSICIONAL"
  };
}

function findLine(lines, matcher, afterTop = -1) {
  return (Array.isArray(lines) ? lines : []).find((line) => line.top > afterTop && matcher(line.normalized, line.text)) || null;
}

function sectionRectangle(lines, pageWidth, pageHeight, startMatcher, endMatcher, fallback = null) {
  const start = findLine(lines, startMatcher);
  if (!start) return fallback;
  const end = findLine(lines, endMatcher, start.bottom);
  const top = Math.max(0, start.top - 3);
  const bottom = end ? Math.min(pageHeight, end.top + 2) : Math.min(pageHeight, start.bottom + pageHeight * 0.45);
  return {
    left: Math.max(0, pageWidth * 0.02),
    top,
    width: pageWidth * 0.96,
    height: Math.max(20, bottom - top)
  };
}

function planSignalScore(text) {
  const source = normalize(text);
  let score = 0;
  if (source.includes("plan individual de formacion y capacitacion")) score += 4;
  else if (source.includes("plan individual") && source.includes("formacion")) score += 2;
  if (source.includes("pro 251")) score += 3;
  if (source.includes("nombre docente") || (source.includes("docente") && source.includes("carrera"))) score += 1;
  if (source.includes("resumen de capacitacion") || source.includes("capacitacion propuesta")) score += 2;
  if (source.includes("impacto esperado") || source.includes("vision a largo plazo")) score += 1;
  return score;
}

function isUsablePlanText(text) {
  const source = clean(text);
  return source.length >= 550 && planSignalScore(source) >= 5;
}

function buildPageLayout(words, lines, pageNumber, pageWidth, pageHeight) {
  const layout = {
    header: null,
    codeRegion: null,
    table: null,
    activities: null,
    impact: null,
    vision: null
  };

  if (pageNumber <= 2) {
    const headerRectangle = { left: 0, top: 0, width: pageWidth, height: pageHeight * 0.22 };
    layout.header = makeRegion(words, headerRectangle, pageNumber, pageWidth, pageHeight);
    layout.codeRegion = makeRegion(words, {
      left: pageWidth * 0.48,
      top: 0,
      width: pageWidth * 0.52,
      height: pageHeight * 0.24
    }, pageNumber, pageWidth, pageHeight);
  }

  const pageText = lines.map((line) => line.text).join("\n");
  const normalizedPage = normalize(pageText);
  const tableFallback = normalizedPage.includes("capacitacion propuesta") && normalizedPage.includes("horas")
    ? { left: pageWidth * 0.02, top: pageHeight * 0.04, width: pageWidth * 0.96, height: pageHeight * 0.64 }
    : null;
  const tableRectangle = sectionRectangle(
    lines,
    pageWidth,
    pageHeight,
    (normalized) => normalized.includes("resumen") && normalized.includes("capacitacion") && normalized.includes("propuesta"),
    (normalized) => normalized.includes("indicadores"),
    tableFallback
  );
  if (tableRectangle) layout.table = makeRegion(words, tableRectangle, pageNumber, pageWidth, pageHeight);

  const activitiesRectangle = sectionRectangle(
    lines,
    pageWidth,
    pageHeight,
    (normalized) => /(^| )6 actividades( |$)/.test(normalized) || normalized === "actividades",
    (normalized) => normalized.includes("7 impacto esperado") || normalized.includes("impacto esperado en el docente")
  );
  if (activitiesRectangle) layout.activities = makeRegion(words, activitiesRectangle, pageNumber, pageWidth, pageHeight);

  const impactRectangle = sectionRectangle(
    lines,
    pageWidth,
    pageHeight,
    (normalized) => normalized.includes("impacto esperado en el docente") || normalized.includes("7 impacto esperado"),
    (normalized) => normalized.includes("vision a largo plazo") || normalized.includes("8 vision")
  );
  if (impactRectangle) layout.impact = makeRegion(words, impactRectangle, pageNumber, pageWidth, pageHeight);

  const visionRectangle = sectionRectangle(
    lines,
    pageWidth,
    pageHeight,
    (normalized) => normalized.includes("vision a largo plazo") || normalized.includes("8 vision"),
    (normalized) => normalized.includes("formacion docente")
  );
  if (visionRectangle) layout.vision = makeRegion(words, visionRectangle, pageNumber, pageWidth, pageHeight);

  return layout;
}

async function readPositionalPdf(filePath, options = {}) {
  const maxPages = Math.max(1, Number(options.maxPages || 20));
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = getPdfJs();
  const loadingTask = pdf.getDocument({ data, disableWorker: true });
  const document = await loadingTask.promise;
  const layout = emptyLayout();
  const pageTexts = [];
  const pages = [];

  try {
    const totalPages = Math.min(document.numPages, maxPages);
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport(1.0);
      const content = await page.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const words = (content.items || []).flatMap((item) => splitTextItem(item, pageNumber, viewport.height));
      const lines = groupWordsIntoLines(words);
      const text = lines.map((line) => line.text).filter(Boolean).join("\n");
      const pageLayout = buildPageLayout(words, lines, pageNumber, viewport.width, viewport.height);

      if (pageLayout.header?.text) layout.headers.push(pageLayout.header);
      if (pageLayout.codeRegion?.text) layout.codeRegions.push(pageLayout.codeRegion);
      if (pageLayout.table?.text) layout.tables.push(pageLayout.table);
      if (pageLayout.activities?.text) layout.sections.activities.push(pageLayout.activities);
      if (pageLayout.impact?.text) layout.sections.impact.push(pageLayout.impact);
      if (pageLayout.vision?.text) layout.sections.vision.push(pageLayout.vision);

      pageTexts.push(text);
      pages.push({ page: pageNumber, width: viewport.width, height: viewport.height, words, lines, text });
      if (typeof options.onProgress === "function") {
        options.onProgress({
          phase: "digital-position-page",
          page: pageNumber,
          percent: Math.round((pageNumber / totalPages) * 100),
          message: `Analizando estructura digital ${pageNumber} de ${totalPages}`
        });
      }
    }

    const text = pageTexts.join("\n\n");
    return {
      text,
      pages: document.numPages,
      method: "DIGITAL_POSICIONAL",
      usable: isUsablePlanText(text),
      score: planSignalScore(text),
      layout,
      positionalPages: pages,
      warnings: []
    };
  } finally {
    if (typeof document.destroy === "function") await document.destroy();
  }
}

module.exports = {
  clean,
  normalize,
  splitTextItem,
  groupWordsIntoLines,
  planSignalScore,
  isUsablePlanText,
  readPositionalPdf
};
