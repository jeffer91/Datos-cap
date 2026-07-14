/* =========================================================
Nombre completo: document-selection.validator.js
Ruta o ubicación: /src/validators/document-selection.validator.js
Función o funciones:
- Validar los PDF y detectar a qué sección documental pertenecen.
- Impedir que planes y acuerdos se mezclen en la interfaz.
========================================================= */
"use strict";

const { validatePdfFiles } = require("./document.validator");
const { readPdfFiles } = require("../extractor/pdf.reader");
const { normalizeForSearch } = require("../extractor/normalizer");

const LABELS = Object.freeze({
  "plan-individual": "Plan Individual",
  "acuerdo-patrocinio": "Acuerdo de Patrocinio"
});

function detectDocumentType(text, fileName = "") {
  const source = normalizeForSearch(`${text || ""} ${fileName || ""}`);
  const planByTitle = source.includes("plan individual de formacion y capacitacion docente");
  const planByCode = source.includes("rgi1") && /pro\s*-?\s*251/.test(source);
  if (planByTitle || planByCode) return "plan-individual";

  const agreementByTitle = source.includes("acuerdo de patrocinio institucional");
  const agreementByCode = source.includes("rgi2") && /pro\s*-?\s*134/.test(source);
  if (agreementByTitle || agreementByCode) return "acuerdo-patrocinio";
  return "desconocido";
}

async function validateDocumentSelection(filePaths, expectedType) {
  const base = validatePdfFiles(filePaths);
  const readablePaths = base.files.filter((file) => file.valid).map((file) => file.path);
  const readResult = await readPdfFiles(readablePaths);
  const readByPath = new Map(readResult.documents.map((document) => [document.filePath, document]));

  const files = base.files.map((file) => {
    if (!file.valid) return { ...file, detectedType: "desconocido", typeMatch: false };
    const document = readByPath.get(file.path);
    const detectedType = document && document.ok
      ? detectDocumentType(document.text, document.fileName)
      : "desconocido";
    const errors = [...(file.errors || [])];
    if (!document || !document.ok) {
      errors.push(...((document && document.errors) || ["No se pudo leer el contenido del PDF."]));
    } else if (detectedType === "desconocido") {
      errors.push("No se pudo identificar el tipo de documento.");
    } else if (detectedType !== expectedType) {
      errors.push(`Este documento corresponde a ${LABELS[detectedType] || detectedType}. Cárguelo en su sección correcta.`);
    }
    return {
      ...file,
      detectedType,
      typeMatch: detectedType === expectedType,
      valid: errors.length === 0,
      errors
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
    files,
    validFiles,
    invalidFiles,
    canContinue: validFiles.length > 0
  };
}

module.exports = { LABELS, detectDocumentType, validateDocumentSelection };
