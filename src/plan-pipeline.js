"use strict";

const path = require("path");
const { EnhancedHybridPdfReader } = require("./enhanced-hybrid-reader");
const { readPositionalPdf } = require("./positional-pdf-reader");
const { parsePlanText } = require("./plan-parser");
const { applyLayoutToPlan } = require("./plan-layout");
const { applyPlanIntelligence, resolveSharedDetails } = require("./plan-intelligence");
const { validatePlanRecord } = require("./plan-validation");
const { isLocalAiEnabled, reviewPlanWithLocalAi } = require("./local-ai-review");
const { cleanExtractionText, runHeaderCodeEngine } = require("./header-code-engine");
const { runTextTableEngine } = require("./text-table-engine");
const { consensusPlanRecords } = require("./plan-consensus");

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function problemCount(record) {
  return Object.keys(record?.problemas_campos || {}).length;
}

function emptyLayout() {
  return {
    headers: [],
    codeRegions: [],
    tables: [],
    sections: { activities: [], impact: [], vision: [] }
  };
}

function codeRegionText(layout) {
  return [
    ...(layout?.codeRegions || []).map((item) => item.text),
    ...(layout?.headers || []).map((item) => item.text)
  ].filter(Boolean).join("\n");
}

function codeCandidates(layout) {
  return [
    ...(layout?.codeRegions || []).map((item) => item.text),
    ...(layout?.headers || []).map((item) => item.text)
  ].filter(Boolean);
}

function readingText(reading) {
  return cleanExtractionText(reading?.text || "");
}

function candidateMetadata(metadata, reading, engine) {
  return {
    ...metadata,
    fileName: metadata.fileName || path.basename(metadata.filePath || "plan.pdf"),
    pages: reading.pages,
    method: engine,
    warnings: reading.warnings || []
  };
}

function applyTextTable(record, text, engine) {
  const table = runTextTableEngine(text);
  const current = Array.isArray(record?.capacitaciones) ? record.capacitaciones : [];
  const currentScore = current.reduce((sum, row) => sum + [
    clean(row?.nombre), Number(row?.horas || 0) > 0,
    clean(row?.fecha_inicio_propuesta), clean(row?.fecha_fin_propuesta), clean(row?.tipo)
  ].filter(Boolean).length, 0);
  const tableScore = table.rows.reduce((sum, row) => sum + [
    clean(row?.nombre), Number(row?.horas || 0) > 0,
    clean(row?.fecha_inicio_propuesta), clean(row?.fecha_fin_propuesta), clean(row?.tipo)
  ].filter(Boolean).length, 0);

  const output = JSON.parse(JSON.stringify(record || {}));
  if (table.rows.length && (table.rows.length > current.length || tableScore > currentScore)) {
    const shared = resolveSharedDetails(output);
    output.capacitaciones = table.rows.map((row) => ({
      ...row,
      actividades_teoricas: shared.actividades_teoricas,
      actividades_practicas: shared.actividades_practicas,
      impacto_esperado: shared.impacto_esperado,
      vision_largo_plazo: shared.vision_largo_plazo,
      detalle_compartido_entre_capacitaciones: true
    }));
    output.advertencias = [...new Set([
      ...(output.advertencias || []),
      `El motor textual reconstruyó ${table.rows.length} filas de capacitación.`
    ])];
  }
  output.inteligencia_tabla = {
    ...(output.inteligencia_tabla || {}),
    [`filas_${String(engine || "textual").toLowerCase()}`]: table.rowCount,
    filas_textuales: Math.max(Number(output.inteligencia_tabla?.filas_textuales || 0), table.rowCount),
    confianza_textual: table.confidence
  };
  return output;
}

function parseCandidate(reading, metadata, engine) {
  const text = readingText(reading);
  let record = parsePlanText(text, candidateMetadata(metadata, reading, engine));
  record = applyTextTable(record, text, engine);
  if (reading.layout) record = applyLayoutToPlan(record, reading.layout);

  const header = runHeaderCodeEngine({
    linearText: engine === "DIGITAL_LINEAL" ? text : "",
    positionalText: engine === "DIGITAL_POSICIONAL" ? text : "",
    ocrText: engine.includes("OCR") ? text : "",
    codeRegionText: codeRegionText(reading.layout),
    positionalPages: reading.positionalPages || []
  });
  record.docente = record.docente || {};
  if (header.code) {
    record.docente.codigo_documento = header.code;
    record.docente.periodo_plan = header.period;
  }
  record.deteccion = {
    ...(record.deteccion || {}),
    plantilla: header.template,
    motor_independiente: engine
  };
  record = applyPlanIntelligence(record, {
    rawText: text,
    fileName: metadata.fileName,
    method: engine,
    codeCandidates: codeCandidates(reading.layout)
  });
  record = validatePlanRecord(record, {
    isPlan: record.estado !== "NO_ES_PLAN",
    possiblePlan: record.deteccion?.posible_plan || record.deteccion?.confirmado_como_plan
  });
  return { engine, record, reading, table: runTextTableEngine(text) };
}

function maxDetectedRows(candidates) {
  return Math.max(0, ...(Array.isArray(candidates) ? candidates : []).map((candidate) => Math.max(
    Number(candidate.table?.rowCount || 0),
    Number(candidate.record?.capacitaciones?.length || 0)
  )));
}

function combineCodeResult(candidates) {
  const linear = candidates.find((candidate) => candidate.engine === "DIGITAL_LINEAL");
  const positional = candidates.find((candidate) => candidate.engine === "DIGITAL_POSICIONAL");
  const ocrCandidates = candidates.filter((candidate) => candidate.engine.includes("OCR"));
  return runHeaderCodeEngine({
    linearText: readingText(linear?.reading),
    positionalText: readingText(positional?.reading),
    ocrText: ocrCandidates.map((candidate) => readingText(candidate.reading)).join("\n"),
    codeRegionText: candidates.map((candidate) => codeRegionText(candidate.reading?.layout)).filter(Boolean).join("\n"),
    positionalPages: positional?.reading?.positionalPages || []
  });
}

function finalizeConsensus(candidates) {
  const codeResult = combineCodeResult(candidates);
  let record = consensusPlanRecords(candidates, { codeResult });
  const expectedRows = maxDetectedRows(candidates);
  record.inteligencia_tabla = {
    ...(record.inteligencia_tabla || {}),
    filas_textuales: Math.max(0, ...candidates.map((candidate) => Number(candidate.table?.rowCount || 0))),
    filas_posicionales: Number(candidates.find((candidate) => candidate.engine === "DIGITAL_POSICIONAL")?.record?.capacitaciones?.length || 0),
    filas_ocr: Math.max(0, ...candidates.filter((candidate) => candidate.engine.includes("OCR")).map((candidate) => Number(candidate.record?.capacitaciones?.length || 0))),
    filas_esperadas: expectedRows
  };
  record.deteccion = {
    ...(record.deteccion || {}),
    plantilla: codeResult.template,
    motores_ejecutados: candidates.map((candidate) => candidate.engine)
  };
  return validatePlanRecord(record, { isPlan: true, possiblePlan: true });
}

function needsOcrFallback(record, candidates) {
  if (!candidates.length) return true;
  const template = record?.deteccion?.plantilla;
  const expectedRows = maxDetectedRows(candidates);
  const actualRows = Number(record?.capacitaciones?.length || 0);
  if (template === "MODERNA" && !clean(record?.docente?.codigo_documento)) return true;
  if (expectedRows > actualRows) return true;
  if (problemCount(record) >= 2) return true;
  return false;
}

class PlanProcessingEngine {
  constructor(options = {}) {
    this.maxPages = Math.max(1, Number(options.maxPages || 20));
    this.aiThreshold = Math.max(1, Number(options.aiThreshold || 2));
    this.hybrid = new EnhancedHybridPdfReader({
      maxOcrPages: Math.max(1, Number(options.maxOcrPages || 15)),
      ocrScale: Math.max(1.4, Number(options.ocrScale || 2.55))
    });
  }

  async readIndependent(filePath, onProgress) {
    if (typeof onProgress === "function") {
      onProgress({ phase: "multi-engine-start", message: "Ejecutando motores digital lineal y posicional en paralelo" });
    }
    const [digitalResult, positionalResult] = await Promise.allSettled([
      this.hybrid.readDigital(filePath),
      readPositionalPdf(filePath, { maxPages: this.maxPages, onProgress })
    ]);
    const readings = [];
    const warnings = [];
    if (digitalResult.status === "fulfilled" && clean(digitalResult.value?.text).length >= 80) {
      readings.push({
        text: digitalResult.value.text,
        pages: digitalResult.value.pages,
        method: "DIGITAL_LINEAL",
        layout: emptyLayout(),
        warnings: []
      });
    } else if (digitalResult.status === "rejected") {
      warnings.push(`Motor digital lineal: ${digitalResult.reason?.message || "sin resultado"}`);
    }
    if (positionalResult.status === "fulfilled" && clean(positionalResult.value?.text).length >= 80) {
      readings.push(positionalResult.value);
    } else if (positionalResult.status === "rejected") {
      warnings.push(`Motor digital posicional: ${positionalResult.reason?.message || "sin resultado"}`);
    }
    return { readings, warnings };
  }

  async read(filePath, onProgress) {
    const independent = await this.readIndependent(filePath, onProgress);
    if (independent.readings.length) return independent.readings[0];
    const ocr = await this.hybrid.readOcr(filePath, onProgress);
    return {
      ...ocr,
      method: "OCR",
      warnings: independent.warnings
    };
  }

  async process(filePath, metadata = {}, onProgress) {
    const independent = await this.readIndependent(filePath, onProgress);
    const candidates = [];
    independent.readings.forEach((reading) => {
      const engine = reading.method === "DIGITAL_POSICIONAL" ? "DIGITAL_POSICIONAL" : "DIGITAL_LINEAL";
      candidates.push(parseCandidate(reading, metadata, engine));
    });

    let record = candidates.length ? finalizeConsensus(candidates) : null;
    if (!record || needsOcrFallback(record, candidates)) {
      if (typeof onProgress === "function") {
        onProgress({ phase: "ocr-fallback", message: "Ejecutando OCR independiente para comparar campos dudosos" });
      }
      const ocr = await this.hybrid.readOcr(filePath, onProgress);
      const ocrReading = {
        ...ocr,
        method: independent.readings.length ? "OCR_RESPALDO" : "OCR",
        warnings: independent.warnings
      };
      if (clean(ocrReading.text).length >= 80) {
        candidates.push(parseCandidate(ocrReading, metadata, "OCR_TEXTO"));
        candidates.push(parseCandidate({
          ...ocrReading,
          text: [
            codeRegionText(ocrReading.layout),
            ...(ocrReading.layout?.tables || []).map((item) => item.text),
            ...(ocrReading.layout?.sections?.activities || []).map((item) => item.text),
            ...(ocrReading.layout?.sections?.impact || []).map((item) => item.text),
            ...(ocrReading.layout?.sections?.vision || []).map((item) => item.text)
          ].filter(Boolean).join("\n\n") || ocrReading.text
        }, metadata, "OCR_ESTRUCTURADO"));
        record = finalizeConsensus(candidates);
      }
    }

    if (!record) throw new Error("Ningún motor obtuvo texto suficiente del PDF.");

    const combinedText = candidates.map((candidate) => readingText(candidate.reading)).filter(Boolean).join("\n\n");
    if (isLocalAiEnabled() && problemCount(record) >= this.aiThreshold) {
      if (typeof onProgress === "function") {
        onProgress({ phase: "local-ai", message: "La IA local revisa únicamente campos todavía dudosos" });
      }
      const aiResult = await reviewPlanWithLocalAi(record, combinedText);
      if (aiResult.used) {
        let aiRecord = applyPlanIntelligence(aiResult.record, {
          rawText: combinedText,
          fileName: metadata.fileName,
          method: "IA_LOCAL",
          codeCandidates: []
        });
        aiRecord = validatePlanRecord(aiRecord, { isPlan: true, possiblePlan: true });
        const withAi = finalizeConsensus([...candidates, {
          engine: "IA_LOCAL",
          record: aiRecord,
          reading: { text: combinedText, method: "IA_LOCAL", layout: emptyLayout(), pages: record.archivo?.paginas || 0 }
        }]);
        if (problemCount(withAi) < problemCount(record)) {
          record = withAi;
          candidates.push({ engine: "IA_LOCAL", record: aiRecord, reading: { text: combinedText, method: "IA_LOCAL" } });
        }
      } else if (aiResult.reason && aiResult.reason !== "not-configured") {
        record.advertencias = [...new Set([...(record.advertencias || []), `IA local no disponible: ${aiResult.reason}`])];
      }
    }

    const methods = [...new Set(candidates.map((candidate) => candidate.engine))];
    record.archivo = {
      ...(record.archivo || {}),
      nombre: metadata.fileName || path.basename(filePath),
      ruta: metadata.filePath || filePath,
      hash: metadata.hash || record.archivo?.hash || "",
      tamano: Number(metadata.size || record.archivo?.tamano || 0),
      paginas: Math.max(0, ...candidates.map((candidate) => Number(candidate.reading?.pages || 0))),
      metodo_lectura: "MULTIMOTOR",
      motores_lectura: methods,
      motor_lectura: "CONSENSO_POR_CAMPO"
    };
    record.deteccion = {
      ...(record.deteccion || {}),
      motores_ejecutados: methods,
      consenso_multimotor: true
    };
    record = validatePlanRecord(record, { isPlan: true, possiblePlan: true });

    return {
      record,
      reading: {
        text: combinedText,
        pages: record.archivo.paginas,
        method: "MULTIMOTOR",
        methods,
        candidates: candidates.map((candidate) => ({
          engine: candidate.engine,
          problemas: problemCount(candidate.record),
          capacitaciones: candidate.record?.capacitaciones?.length || 0
        }))
      }
    };
  }

  async close() {
    await this.hybrid.close().catch(() => {});
  }
}

module.exports = {
  problemCount,
  codeCandidates,
  applyTextTable,
  parseCandidate,
  maxDetectedRows,
  combineCodeResult,
  finalizeConsensus,
  needsOcrFallback,
  PlanProcessingEngine
};