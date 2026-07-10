/* =========================================================
Nombre completo: text-quality.js
Ruta o ubicación: /src/readers/text-quality.js
Función o funciones:
- Evaluar si el texto digital extraído de un PDF es suficiente.
- Detectar texto vacío, demasiado corto o con exceso de caracteres extraños.
- Decidir cuándo debe activarse el OCR de respaldo.
========================================================= */

"use strict";

const { normalizeSpaces } = require("../extractor/normalizer");

function countMatches(text, regex) {
  const matches = String(text || "").match(regex);
  return matches ? matches.length : 0;
}

function assessTextQuality(text, options = {}) {
  const compact = normalizeSpaces(text);
  const minCharacters = Number.isFinite(options.minCharacters) ? options.minCharacters : 180;
  const minWords = Number.isFinite(options.minWords) ? options.minWords : 30;
  const characters = compact.length;
  const words = compact ? compact.split(/\s+/).filter(Boolean).length : 0;
  const letters = countMatches(compact, /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g);
  const replacementCharacters = countMatches(compact, /[�￾\uFFFE]/g);
  const letterRatio = characters ? letters / characters : 0;
  const replacementRatio = characters ? replacementCharacters / characters : 0;
  const hasInstitutionalSignals = /UGPA|PLANIFICACI[ÓO]N|CAPACITACI[ÓO]N|CURSO|PRO-\s*134/i.test(compact);
  const sufficient = Boolean(
    characters >= minCharacters &&
    words >= minWords &&
    letterRatio >= 0.45 &&
    replacementRatio <= 0.03
  );

  const reasons = [];
  if (!characters) reasons.push("No se extrajo texto digital.");
  if (characters > 0 && characters < minCharacters) reasons.push("El texto digital es demasiado corto.");
  if (words > 0 && words < minWords) reasons.push("El texto contiene muy pocas palabras.");
  if (characters > 0 && letterRatio < 0.45) reasons.push("La proporción de letras es insuficiente.");
  if (replacementRatio > 0.03) reasons.push("El texto contiene demasiados caracteres defectuosos.");

  return {
    sufficient,
    characters,
    words,
    letters,
    letterRatio: Number(letterRatio.toFixed(4)),
    replacementCharacters,
    replacementRatio: Number(replacementRatio.toFixed(4)),
    hasInstitutionalSignals,
    reasons
  };
}

function shouldUseOcr(text, options = {}) {
  return !assessTextQuality(text, options).sufficient;
}

module.exports = {
  countMatches,
  assessTextQuality,
  shouldUseOcr
};
