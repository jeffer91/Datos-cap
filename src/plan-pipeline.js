"use strict";

const path = require("path");
const { HybridPdfReader } = require("./hybrid-pdf-reader");
const { readPositionalPdf } = require("./positional-pdf-reader");
const { parsePlanText } = require("./plan-parser");
const { applyLayoutToPlan } = require("./plan-layout");
const { applyPlanIntelligence } = require("./plan-intelligence");
const { validatePlanRecord } = require("./plan-validation");
const { isLocalAiEnabled, reviewPlanWithLocalAi } = require("./local-ai-review");

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function problemCount(record) {
  return Object.keys(record?.problemas_campos || {}).length;
}

function codeCandidates(layout) {
  return [
    ...(layout?.codeRegions || []).map((item) => item.text),
    ...(layout?.headers || []).map((item) => item.text)
  ].filter(Boolean);
}

class PlanProcessingEngine {
  constructor(options = {}) {
    this.maxPages = Math.max(1, Number(options.maxPages || 20));
    this.aiThreshold = Math.max(1, Number(options.aiThreshold || 4));
    this.hybrid = new HybridPdfReader({
      maxOcrPages: Math.max(1, Number(options.maxOcrPages || 15)),
      ocrScale: Math.max(1.4, Number(options.ocrScale || 2.55))
    });
  }

  async read(filePath, onProgress) {
    let positionalWarning = "";
    try {
      if (typeof onProgress === "function") {
        onProgress({ phase: "digital-position-start", message: "Analizando texto y coordenadas del PDF" });
      }
      const positional = await readPositionalPdf(filePath, {
        maxPages: this.maxPages,
        onProgress
      });
      if (positional.usable) return positional;
      positionalWarning = "El texto posicional no fue suficiente; se aplicó el lector híbrido.";
    } catch (error) {
      positionalWarning = `Lectura posicional: ${error.message}`;
    }

    const fallback = await this.hybrid.read(filePath, onProgress);
    fallback.warnings = [...new Set([positionalWarning, ...(fallback.warnings || [])].filter(Boolean))];
    return fallback;
  }

  parse(reading, metadata = {}) {
    const basic = parsePlanText(reading.text, {
      ...metadata,
      fileName: metadata.fileName || path.basename(metadata.filePath || "plan.pdf"),
      pages: reading.pages,
      method: reading.method,
      warnings: reading.warnings
    });
    const structured = applyLayoutToPlan(basic, reading.layout || {});
    const intelligent = applyPlanIntelligence(structured, {
      rawText: reading.text,
      fileName: metadata.fileName,
      method: reading.method,
      codeCandidates: codeCandidates(reading.layout)
    });
    return validatePlanRecord(intelligent, {
      isPlan: intelligent.estado !== "NO_ES_PLAN",
      possiblePlan: intelligent.deteccion?.posible_plan || intelligent.deteccion?.confirmado_como_plan
    });
  }

  async process(filePath, metadata = {}, onProgress) {
    const reading = await this.read(filePath, onProgress);
    if (clean(reading.text).length < 80) throw new Error("No se obtuvo texto suficiente del PDF.");

    let record = this.parse(reading, metadata);
    if (
      isLocalAiEnabled()
      && ["OCR", "MIXTO"].includes(String(reading.method || "").toUpperCase())
      && problemCount(record) >= this.aiThreshold
    ) {
      if (typeof onProgress === "function") {
        onProgress({ phase: "local-ai", message: "Revisando campos dudosos con IA local" });
      }
      const aiResult = await reviewPlanWithLocalAi(record, reading.text);
      if (aiResult.used) {
        const intelligent = applyPlanIntelligence(aiResult.record, {
          rawText: reading.text,
          fileName: metadata.fileName,
          method: `${reading.method}+IA_LOCAL`,
          codeCandidates: codeCandidates(reading.layout)
        });
        const evaluated = validatePlanRecord(intelligent, {
          isPlan: true,
          possiblePlan: true
        });
        if (problemCount(evaluated) < problemCount(record)) record = evaluated;
      } else if (aiResult.reason && aiResult.reason !== "not-configured") {
        record.advertencias = [...new Set([...(record.advertencias || []), `IA local no disponible: ${aiResult.reason}`])];
      }
    }

    record.archivo = {
      ...(record.archivo || {}),
      metodo_lectura: reading.method,
      motor_lectura: reading.method === "DIGITAL_POSICIONAL" ? "PDFJS_COORDENADAS" : "HIBRIDO_TESSERACT"
    };
    return { record, reading };
  }

  async close() {
    await this.hybrid.close().catch(() => {});
  }
}

module.exports = {
  problemCount,
  codeCandidates,
  PlanProcessingEngine
};
