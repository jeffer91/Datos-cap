/* =========================================================
Nombre completo: document-selection.validator.js
Ruta o ubicación: /src/validators/document-selection.validator.js
Función o funciones:
- Validar PDF y detectar seis tipos documentales.
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

function detectDocumentType(text, fileName = "") {
  const source = normalizeForSearch(`${text || ""} ${fileName || ""}`);

  const impactByTitle = source.includes("informe de impacto") ||
    source.includes("informe del impacto") ||
    source.includes("medicion de impacto de la capacitacion") ||
    source.includes("evaluacion de impacto de la capacitacion");
  const impactByCode = /pro\s*-?\s*135/.test(source) && /(?:impacto|medicion de impacto)/.test(source);
  if (impactByTitle || impactByCode) return "informe-impacto";

  const instrumentByTitle = source.includes("instrumento de evaluacion") ||
    source.includes("instrumento para la evaluacion") ||
    source.includes("ficha de evaluacion de la capacitacion") ||
    source.includes("encuesta de evaluacion de la capacitacion");
  const instrumentByCode = /pro\s*-?\s*135/.test(source) && /(?:instrumento|encuesta|ficha)\s+(?:de|para la)?\s*evaluacion/.test(source);
  if (instrumentByTitle || instrumentByCode) return "instrumento-evaluacion";

  const finalReportByTitle = source.includes("informe final de la capacitacion") ||
    source.includes("informe final de capacitacion de") ||
    source.includes("informe final de capacitacion:");
  const finalReportByCode = /(?:^|\s|-)inf(?:\s|-)/.test(source) && /pro\s*-?\s*134/.test(source);
  if (finalReportByTitle || finalReportByCode) return "informe-final-capacitacion";

  const planningByTitle = source.includes("planificacion de capacitacion") ||
    source.includes("planificacion de la capacitacion");
  const planningByCode = source.includes("rgi1") && /pro\s*-?\s*134/.test(source);
  if (planningByTitle || planningByCode) return "planificacion-capacitacion";

  const planByTitle = source.includes("plan individual de formacion y capacitacion docente");
  const planByCode = source.includes("rgi1") && /pro\s*-?\s*251/.test(source);
  if (planByTitle || planByCode) return "plan-individual";

  const agreementByTitle = source.includes("acuerdo de patrocinio institucional");
  const agreementByCode = source.includes("rgi2") && /pro\s*-?\s*134/.test(source);
  if (agreementByTitle || agreementByCode) return "acuerdo-patrocinio";

  return "desconocido";
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
    if (!file.valid) return { ...file, detectedType: "desconocido", typeMatch: false };
    const document = readByPath.get(file.path);
    const detectedType = document && document.ok
      ? detectDocumentType(document.text, document.fileName)
      : "desconocido";
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
  detectDocumentType,
  validateDocumentSelection
};
