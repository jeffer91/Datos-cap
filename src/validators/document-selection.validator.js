/* =========================================================
Nombre completo: document-selection.validator.js
Ruta o ubicación: /src/validators/document-selection.validator.js
Función o funciones:
- Validar PDF y detectar seis tipos documentales.
- Priorizar códigos institucionales y encabezados sobre frases incidentales del cuerpo.
- Aplicar OCR breve durante la identificación cuando sea necesario.
- Impedir que documentos se carguen en una sección equivocada.
========================================================= */
"use strict";

const { validatePdfFiles } = require("./document.validator");
const { readPdfFilesHybrid } = require("../readers/pdf-hybrid.reader");
const { normalizeForSearch } = require("../extractor/normalizer");

const LABELS = Object.freeze({
  "plan-individual": "Plan Individual",
  "acuerdo-patrocinio": "Acuerdo de Patrocinio",
  "planificacion-capacitacion": "Planificación de Capacitación",
  "informe-final-capacitacion": "Informe Final de Capacitación",
  "instrumento-evaluacion": "Instrumento de Evaluación",
  "informe-impacto": "Informe de Impacto"
});

const TITLE_HINTS = Object.freeze({
  "plan-individual": [
    "plan individual de formacion y capacitacion docente",
    "plan individual de capacitacion y formacion docente",
    "plan individual de formacion y capacitacion"
  ],
  "acuerdo-patrocinio": [
    "acuerdo de patrocinio institucional",
    "acuerdo de patrocinio"
  ],
  "planificacion-capacitacion": [
    "planificacion de capacitacion",
    "planificacion de la capacitacion"
  ],
  "informe-final-capacitacion": [
    "informe final de la capacitacion",
    "informe final de capacitacion"
  ],
  "instrumento-evaluacion": [
    "instrumento de evaluacion de la capacitacion",
    "instrumento de evaluacion",
    "instrumento para la evaluacion",
    "ficha de evaluacion de la capacitacion",
    "encuesta de evaluacion de la capacitacion"
  ],
  "informe-impacto": [
    "informe de impacto de la capacitacion",
    "informe de impacto",
    "informe del impacto",
    "medicion de impacto de la capacitacion",
    "evaluacion de impacto de la capacitacion"
  ]
});

function includesAny(source, values) {
  return (values || []).some((value) => source.includes(value));
}

function hasCodePair(source, family, processCode) {
  const clean = String(source || "");
  const familyPattern = new RegExp(`(?:^|[^a-z0-9])${family}(?:[^a-z0-9]|$)`, "i");
  const processPattern = new RegExp(`(?:^|[^a-z0-9])pro\\s*-?\\s*${processCode}(?:[^0-9]|$)`, "i");
  return familyPattern.test(clean) && processPattern.test(clean);
}

function createDetection(type, confidence, reason, signals = []) {
  return { type, confidence, reason, signals };
}

function detectDocumentTypeDetailed(text, fileName = "") {
  const rawText = String(text || "");
  const fileSource = normalizeForSearch(fileName || "");
  const headerSource = normalizeForSearch(rawText.slice(0, 5000));
  const fullSource = normalizeForSearch(`${rawText} ${fileName || ""}`);
  const strongSources = [fileSource, headerSource];

  const strongCodeRules = [
    { type: "plan-individual", family: "rgi1", process: "251", label: "RGI1 + PRO-251" },
    { type: "acuerdo-patrocinio", family: "rgi2", process: "134", label: "RGI2 + PRO-134" },
    { type: "planificacion-capacitacion", family: "rgi1", process: "134", label: "RGI1 + PRO-134" },
    { type: "informe-final-capacitacion", family: "inf", process: "134", label: "INF + PRO-134" }
  ];

  for (const rule of strongCodeRules) {
    if (strongSources.some((source) => hasCodePair(source, rule.family, rule.process))) {
      return createDetection(rule.type, 100, `Código institucional ${rule.label}.`, [rule.label]);
    }
  }

  for (const [type, titles] of Object.entries(TITLE_HINTS)) {
    if (includesAny(fileSource, titles)) {
      return createDetection(type, 98, "Título reconocido en el nombre del archivo.", ["nombre_archivo"]);
    }
    if (includesAny(headerSource, titles)) {
      return createDetection(type, 96, "Título reconocido en el encabezado del documento.", ["encabezado"]);
    }
  }

  const scores = Object.fromEntries(Object.keys(LABELS).map((type) => [type, { score: 0, signals: [] }]));
  const add = (type, points, signal) => {
    scores[type].score += points;
    scores[type].signals.push(signal);
  };

  if (hasCodePair(fullSource, "rgi1", "251")) add("plan-individual", 14, "RGI1 + PRO-251");
  if (hasCodePair(fullSource, "rgi2", "134")) add("acuerdo-patrocinio", 14, "RGI2 + PRO-134");
  if (hasCodePair(fullSource, "rgi1", "134")) add("planificacion-capacitacion", 14, "RGI1 + PRO-134");
  if (hasCodePair(fullSource, "inf", "134")) add("informe-final-capacitacion", 14, "INF + PRO-134");

  Object.entries(TITLE_HINTS).forEach(([type, titles]) => {
    if (includesAny(fullSource, titles)) add(type, 8, "título en contenido");
  });

  if (/pro\s*-?\s*135/.test(fullSource)) {
    add("instrumento-evaluacion", 2, "PRO-135");
    add("informe-impacto", 2, "PRO-135");
  }
  if (/(?:encuesta|cuestionario|criterios de evaluacion|escala de valoracion|satisfaccion)/.test(fullSource)) {
    add("instrumento-evaluacion", 4, "contenido de evaluación");
  }
  if (/(?:indicadores de impacto|linea base|cambios observados|aplicacion de lo aprendido)/.test(fullSource)) {
    add("informe-impacto", 4, "contenido de impacto");
  }
  if (/(?:capacidades actuales|capacitaciones propuestas|formacion academica propuesta|plan individual)/.test(fullSource)) {
    add("plan-individual", 4, "contenido de plan individual");
  }
  if (/(?:compromisos del colaborador|patrocinio institucional|beneficios concedidos)/.test(fullSource)) {
    add("acuerdo-patrocinio", 4, "contenido de patrocinio");
  }
  if (/(?:topicos o temas cubiertos|ambiente de aprendizaje|forma de ejecucion)/.test(fullSource)) {
    add("planificacion-capacitacion", 4, "contenido de planificación");
  }
  if (/(?:matriz con los datos de los participantes|resumen entrega de certificados|cumplimiento de los objetivos del curso)/.test(fullSource)) {
    add("informe-final-capacitacion", 4, "contenido de informe final");
  }

  const ranking = Object.entries(scores)
    .map(([type, data]) => ({ type, ...data }))
    .sort((left, right) => right.score - left.score);
  const best = ranking[0];
  const second = ranking[1];

  if (!best || best.score < 4 || (second && best.score === second.score)) {
    return createDetection("desconocido", 0, "No hubo señales suficientes o inequívocas.", []);
  }

  const confidence = Math.min(94, 60 + (best.score * 2));
  return createDetection(best.type, confidence, `Clasificación por señales combinadas: ${best.signals.join(", ")}.`, best.signals);
}

function detectDocumentType(text, fileName = "") {
  return detectDocumentTypeDetailed(text, fileName).type;
}

async function validateDocumentSelection(filePaths, expectedType, options = {}) {
  const base = validatePdfFiles(filePaths);
  const readablePaths = base.files.filter((file) => file.valid).map((file) => file.path);
  const readResult = await readPdfFilesHybrid(readablePaths, {
    onDocumentStart: options.onDocumentStart,
    onModeChange: options.onModeChange,
    onProgress: options.onOcrProgress,
    onPageStart: options.onPageStart,
    onPageRender: options.onPageRender,
    quality: { minCharacters: 100, minWords: 15 },
    ocr: { maxPages: 2, scale: 1.8 }
  });
  const readByPath = new Map(readResult.documents.map((document) => [document.filePath, document]));

  const files = base.files.map((file) => {
    if (!file.valid) return { ...file, detectedType: "desconocido", typeMatch: false, detectionConfidence: 0, detectionReason: "Archivo inválido." };
    const document = readByPath.get(file.path);
    const detection = document && document.ok
      ? detectDocumentTypeDetailed(document.text, document.fileName)
      : createDetection("desconocido", 0, "No se pudo leer el documento.");
    const detectedType = detection.type;
    const errors = [...(file.errors || [])];

    if (!document || !document.ok) {
      errors.push(...((document && document.errors) || ["No se pudo leer ni escanear el contenido del PDF."]));
    } else if (detectedType === "desconocido") {
      errors.push("No se pudo identificar el tipo de documento en las primeras páginas.");
    } else if (detectedType !== expectedType) {
      errors.push(`Este documento corresponde a ${LABELS[detectedType] || detectedType}. Cárguelo en su sección correcta.`);
    }

    return {
      ...file,
      fileHash: document?.fileHash || file.fileHash || "",
      detectedType,
      typeMatch: detectedType === expectedType,
      detectionConfidence: detection.confidence,
      detectionReason: detection.reason,
      detectionSignals: detection.signals,
      extractionMethod: document?.extractionMethod || "",
      pageCount: document?.pageCount || 0,
      ocrPageCount: document?.ocrPageCount || 0,
      ocrConfidence: document?.ocrConfidence || 0,
      valid: errors.length === 0,
      errors,
      warnings: document?.warnings || []
    };
  });

  const validFiles = files.filter((file) => file.valid);
  const invalidFiles = files.filter((file) => !file.valid);
  return {
    documentType: expectedType,
    total: files.length,
    validCount: validFiles.length,
    invalidCount: invalidFiles.length,
    duplicateCount: files.filter((file) => file.duplicate).length,
    digitalCount: files.filter((file) => file.extractionMethod === "digital").length,
    ocrCount: files.filter((file) => file.extractionMethod === "ocr").length,
    mixedCount: files.filter((file) => file.extractionMethod === "mixed").length,
    files,
    validFiles,
    invalidFiles,
    canContinue: validFiles.length > 0
  };
}

module.exports = {
  LABELS,
  TITLE_HINTS,
  detectDocumentType,
  detectDocumentTypeDetailed,
  validateDocumentSelection
};