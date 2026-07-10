/* =========================================================
Nombre completo: course.normalizer.js
Ruta o ubicación: /src/reporting/normalization/course.normalizer.js
Función o funciones:
- Crear claves comparables para cursos y carreras.
- Conservar el nombre original junto con la versión normalizada.
- Incorporar el periodo para evitar mezclar ediciones distintas del mismo curso.
========================================================= */

"use strict";

const {
  displayText,
  normalizeKey,
  normalizePeriod,
  firstNonEmpty
} = require("./text.normalizer");

const COURSE_PREFIX_PATTERN = /^(?:curso|taller|seminario|capacitacion|capacitación|programa|jornada|webinar)\s+(?:de|del|sobre|en)?\s*/i;

function normalizeCourseName(value) {
  return normalizeKey(displayText(value).replace(COURSE_PREFIX_PATTERN, ""));
}

function normalizeCareer(value) {
  return normalizeKey(value);
}

function createCourseKey(courseName, period) {
  const courseKey = normalizeCourseName(courseName);
  if (!courseKey) return "";
  const periodKey = normalizePeriod(period);
  return `${periodKey || "sin-periodo"}|${courseKey}`;
}

function extractCourse(record, source, fallbackPeriod = "") {
  const config = source || {};
  const name = firstNonEmpty(record, config.courseFields || []);
  const period = firstNonEmpty(record, config.periodFields || []) || fallbackPeriod;
  const career = firstNonEmpty(record, config.careerFields || []);

  return {
    courseKey: createCourseKey(name, period),
    name: displayText(name),
    nameKey: normalizeCourseName(name),
    period: displayText(period),
    periodKey: normalizePeriod(period),
    career: displayText(career),
    careerKey: normalizeCareer(career)
  };
}

function choosePreferredCourseName(names) {
  const values = [...new Set((names || []).map(displayText).filter(Boolean))];
  return values.sort((a, b) => b.length - a.length)[0] || "";
}

module.exports = {
  COURSE_PREFIX_PATTERN,
  normalizeCourseName,
  normalizeCareer,
  createCourseKey,
  extractCourse,
  choosePreferredCourseName
};
