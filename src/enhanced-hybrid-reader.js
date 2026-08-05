"use strict";

const { HybridPdfReader } = require("./hybrid-pdf-reader");

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tableScore(region) {
  const source = normalize(region?.text);
  if (!source) return 0;
  const rowNumbers = (source.match(/(?:^| )\d{1,2}(?= )/g) || []).length;
  const hours = (source.match(/(?:^| )\d{1,4}(?: horas?| h)?(?= |$)/g) || []).length;
  const dates = (source.match(/\b(?:desde|hasta|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/g) || []).length;
  const types = (source.match(/\b(?:aprobacion|certificacion|asistencia|curso|taller|seminario|congreso|diplomado)\b/g) || []).length;
  return (rowNumbers * 4) + (types * 5) + (dates * 2) + Math.min(12, hours) + Math.min(15, (region?.words || []).length / 8);
}

function activityScore(region) {
  const source = normalize(region?.text);
  if (!source) return 0;
  let score = Math.min(20, source.length / 30);
  if (source.includes("teoricas") || source.includes("teorica")) score += 8;
  if (source.includes("practicas") || source.includes("practica")) score += 8;
  return score;
}

class EnhancedHybridPdfReader extends HybridPdfReader {
  async analyzePageLayout(worker, image, pageNumber, fullResult, onProgress) {
    const layout = await super.analyzePageLayout(worker, image, pageNumber, fullResult, onProgress);

    if (layout.codeRegion?.rectangle) {
      const codeLine = await this.recognizeRegion(
        worker,
        image,
        { width: layout.codeRegion.rectangle.left + layout.codeRegion.rectangle.width, height: layout.codeRegion.rectangle.top + layout.codeRegion.rectangle.height },
        layout.codeRegion.rectangle,
        {
          psm: "7",
          whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",
          preserveSpaces: false
        }
      ).catch(() => null);
      if (codeLine?.text) {
        layout.codeRegion.text = `${layout.codeRegion.text || ""}\n${codeLine.text}`.trim();
        layout.codeRegion.codeOnlyText = `${layout.codeRegion.codeOnlyText || ""}\n${codeLine.text}`.trim();
      }
    }

    if (layout.table?.rectangle) {
      if (typeof onProgress === "function") {
        onProgress({ phase: "ocr-consensus", page: pageNumber, message: `Comparando lecturas de tabla en la página ${pageNumber}` });
      }
      const dimensions = {
        width: Number(layout.table.pageWidth || layout.table.rectangle.left + layout.table.rectangle.width),
        height: Number(layout.table.pageHeight || layout.table.rectangle.top + layout.table.rectangle.height)
      };
      const alternatives = await Promise.all([
        Promise.resolve(layout.table),
        this.recognizeRegion(worker, image, dimensions, layout.table.rectangle, { psm: "4", tsv: true, preserveSpaces: true }).catch(() => null),
        this.recognizeRegion(worker, image, dimensions, layout.table.rectangle, { psm: "11", tsv: true, preserveSpaces: true }).catch(() => null)
      ]);
      const best = alternatives.filter(Boolean)
        .map((candidate) => ({ ...candidate, page: pageNumber, pageWidth: dimensions.width, pageHeight: dimensions.height }))
        .sort((left, right) => tableScore(right) - tableScore(left))[0];
      if (best) {
        best.consensusScore = tableScore(best);
        best.ocrPasses = alternatives.filter(Boolean).length;
        layout.table = best;
      }
    }

    if (layout.activities?.rectangle) {
      const dimensions = {
        width: Number(layout.activities.pageWidth || layout.activities.rectangle.left + layout.activities.rectangle.width),
        height: Number(layout.activities.pageHeight || layout.activities.rectangle.top + layout.activities.rectangle.height)
      };
      const alternate = await this.recognizeRegion(
        worker,
        image,
        dimensions,
        layout.activities.rectangle,
        { psm: "4", tsv: true, preserveSpaces: true }
      ).catch(() => null);
      if (alternate && activityScore(alternate) > activityScore(layout.activities)) {
        layout.activities = { ...alternate, page: pageNumber, ocrPasses: 2 };
      }
    }

    return layout;
  }
}

module.exports = {
  tableScore,
  activityScore,
  EnhancedHybridPdfReader
};
