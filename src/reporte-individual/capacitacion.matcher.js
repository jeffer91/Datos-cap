/* =========================================================
Nombre completo: capacitacion.matcher.js
Ruta o ubicación: /src/reporte-individual/capacitacion.matcher.js
Función o funciones:
- Normalizar nombres de capacitaciones con pequeñas variaciones.
- Calcular coincidencia exacta, alta, dudosa o inexistente.
========================================================= */
"use strict";

const STOP_WORDS = new Set([
  "de", "del", "la", "las", "el", "los", "para", "en", "a", "al", "y", "e",
  "un", "una", "unos", "unas", "curso", "taller", "seminario", "capacitacion"
]);

function text(value) { return String(value == null ? "" : value).trim(); }
function normalizeTrainingName(value) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .split(" ")
    .filter((token) => token && !STOP_WORDS.has(token))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return [...new Set(normalizeTrainingName(value).split(" ").filter((token) => token.length > 1))];
}

function trainingSimilarity(left, right) {
  const normalizedLeft = normalizeTrainingName(left);
  const normalizedRight = normalizeTrainingName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;

  const a = tokens(normalizedLeft);
  const b = tokens(normalizedRight);
  const intersection = a.filter((token) => b.includes(token)).length;
  const union = new Set([...a, ...b]).size;
  const containment = intersection / Math.min(a.length || 1, b.length || 1);
  const jaccard = union ? intersection / union : 0;
  const phraseContainment = normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft) ? 1 : 0;
  return Number((containment * 0.55 + jaccard * 0.3 + phraseContainment * 0.15).toFixed(4));
}

function classifyTrainingMatch(left, right) {
  const score = trainingSimilarity(left, right);
  return {
    matched: score >= 0.58,
    score,
    level: score === 1 ? "EXACTA" : score >= 0.76 ? "ALTA" : score >= 0.58 ? "DUDOSA" : "SIN_COINCIDENCIA",
    leftNormalized: normalizeTrainingName(left),
    rightNormalized: normalizeTrainingName(right)
  };
}

function pickTrainingName(record) {
  const row = record || {};
  return text(
    row.nombre_capacitacion || row.capacitacion || row.nombre_curso || row.titulo_capacitacion ||
    row.curso || row.nombre_evento || row.actividad
  );
}

function findBestTrainingMatch(trainingName, candidates) {
  let best = null;
  (Array.isArray(candidates) ? candidates : []).forEach((record) => {
    const match = classifyTrainingMatch(trainingName, pickTrainingName(record));
    if (!best || match.score > best.score) best = { ...match, record };
  });
  return best && best.matched ? best : null;
}

module.exports = {
  STOP_WORDS,
  normalizeTrainingName,
  trainingSimilarity,
  classifyTrainingMatch,
  pickTrainingName,
  findBestTrainingMatch
};
