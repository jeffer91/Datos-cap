/* =========================================================
Nombre completo: docente.matcher.js
Ruta o ubicación: /src/reporte-individual/docente.matcher.js
Función o funciones:
- Normalizar cédulas y nombres de docentes.
- Relacionar docentes por cédula y usar el nombre solo como respaldo.
========================================================= */
"use strict";

function text(value) { return String(value == null ? "" : value).trim(); }
function removeAccents(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeCedula(value) {
  const digits = text(value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 9 ? digits.padStart(10, "0") : digits;
}

function normalizeTeacherName(value) {
  return removeAccents(value)
    .toLowerCase()
    .replace(/\b(?:dr|dra|ing|lic|msc|mgs|magister|phd|abg|eco|arquitecto|arquitecta)\.?\b/g, " ")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value) {
  return [...new Set(normalizeTeacherName(value).split(" ").filter((token) => token.length > 1))];
}

function teacherNameSimilarity(left, right) {
  const a = nameTokens(left);
  const b = nameTokens(right);
  if (!a.length || !b.length) return 0;
  const intersection = a.filter((token) => b.includes(token)).length;
  const union = new Set([...a, ...b]).size;
  const containment = intersection / Math.min(a.length, b.length);
  const jaccard = union ? intersection / union : 0;
  return Number((containment * 0.7 + jaccard * 0.3).toFixed(4));
}

function pickCedula(record) {
  const row = record || {};
  return normalizeCedula(
    row.cedula || row.cedula_docente || row.identificacion || row.numero_identificacion ||
    row.documento_identidad || row.cedula_identidad
  );
}

function pickTeacherName(record) {
  const row = record || {};
  return text(
    row.nombre_docente || row.docente || row.nombres_apellidos || row.nombre_participante ||
    row.nombre_completo || row.nombre
  );
}

function matchTeacher(target, candidate) {
  const targetCedula = pickCedula(target);
  const candidateCedula = pickCedula(candidate);
  if (targetCedula && candidateCedula) {
    return {
      matched: targetCedula === candidateCedula,
      method: "CEDULA",
      score: targetCedula === candidateCedula ? 1 : 0
    };
  }

  const score = teacherNameSimilarity(pickTeacherName(target), pickTeacherName(candidate));
  return {
    matched: score >= 0.82,
    method: "NOMBRE",
    score
  };
}

function findBestTeacherMatch(target, candidates) {
  let best = null;
  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    const match = matchTeacher(target, candidate);
    if (!best || match.score > best.score || (match.method === "CEDULA" && best.method !== "CEDULA")) {
      best = { ...match, record: candidate };
    }
  });
  return best && best.matched ? best : null;
}

module.exports = {
  normalizeCedula,
  normalizeTeacherName,
  teacherNameSimilarity,
  pickCedula,
  pickTeacherName,
  matchTeacher,
  findBestTeacherMatch
};
