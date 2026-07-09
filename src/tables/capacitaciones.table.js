/* =========================================================
Nombre completo: capacitaciones.table.js
Ruta o ubicación: /plan-docente-extractor/src/tables/capacitaciones.table.js
Función o funciones:
- Construir la tabla no relacional capacitaciones_propuestas.
- Permitir varias capacitaciones por cada documento/docente.
- Normalizar nombre, horas, fechas, tipo y observaciones de extracción.
- Marcar registros sin capacitación detectada para revisión.
========================================================= */

"use strict";

const { createRowId } = require("../utils/ids");

const CAPACITACIONES_COLUMNS = [
  "id",
  "id_documento",
  "codigo_documento",
  "nombre_docente",
  "carrera",
  "numero_capacitacion",
  "nombre_capacitacion",
  "horas_capacitacion",
  "fecha_inicio_capacitacion",
  "fecha_fin_capacitacion",
  "fecha_texto_original",
  "tipo_capacitacion",
  "requiere_revision",
  "observacion_extraccion"
];

function emptyRow() {
  return {
    id: "",
    id_documento: "",
    codigo_documento: "",
    nombre_docente: "",
    carrera: "",
    numero_capacitacion: "",
    nombre_capacitacion: "",
    horas_capacitacion: "",
    fecha_inicio_capacitacion: "",
    fecha_fin_capacitacion: "",
    fecha_texto_original: "",
    tipo_capacitacion: "",
    requiere_revision: "SI",
    observacion_extraccion: ""
  };
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[:\-–—\s]+/, "")
    .replace(/[:\-–—\s]+$/, "")
    .trim();
}

function parseDateYear(value) {
  const text = cleanText(value);
  const match = text.match(/(\d{4})$/);
  return match ? Number(match[1]) : 0;
}

function hasSuspiciousDate(row) {
  const startYear = parseDateYear(row.fecha_inicio_capacitacion);
  const endYear = parseDateYear(row.fecha_fin_capacitacion);

  if (!startYear || !endYear) {
    return false;
  }

  if (endYear < startYear) {
    return true;
  }

  return endYear - startYear > 2;
}

function normalizeCapacitacionRow(row, index = 0) {
  const base = emptyRow();
  const clean = {
    ...base,
    ...(row || {})
  };

  Object.keys(clean).forEach((key) => {
    if (typeof clean[key] === "string") {
      clean[key] = cleanText(clean[key]);
    }
  });

  if (!clean.numero_capacitacion) {
    clean.numero_capacitacion = index + 1;
  }

  if (!clean.fecha_texto_original && (clean.fecha_inicio_capacitacion || clean.fecha_fin_capacitacion)) {
    clean.fecha_texto_original = `${clean.fecha_inicio_capacitacion} al ${clean.fecha_fin_capacitacion}`.trim();
  }

  if (!clean.tipo_capacitacion) {
    clean.tipo_capacitacion = "Aprobación";
  }

  if (!clean.id && clean.id_documento) {
    clean.id = createRowId("capacitacion", clean.id_documento, index, clean.nombre_capacitacion);
  }

  const missing = [];

  if (!clean.id_documento) missing.push("id_documento");
  if (!clean.codigo_documento) missing.push("codigo_documento");
  if (!clean.nombre_docente) missing.push("nombre_docente");
  if (!clean.nombre_capacitacion) missing.push("nombre_capacitacion");
  if (!clean.horas_capacitacion) missing.push("horas_capacitacion");
  if (!clean.fecha_inicio_capacitacion) missing.push("fecha_inicio_capacitacion");
  if (!clean.fecha_fin_capacitacion) missing.push("fecha_fin_capacitacion");

  const observations = [];

  if (missing.length) {
    observations.push(`Campos faltantes: ${missing.join(", ")}.`);
  }

  if (hasSuspiciousDate(clean)) {
    observations.push("Fecha de capacitación posiblemente incorrecta o demasiado extensa.");
  }

  if (observations.length) {
    clean.requiere_revision = "SI";

    if (!clean.observacion_extraccion) {
      clean.observacion_extraccion = observations.join(" ");
    }
  } else {
    clean.requiere_revision = clean.requiere_revision === "SI" ? "SI" : "NO";
  }

  return CAPACITACIONES_COLUMNS.reduce((acc, column) => {
    acc[column] = typeof clean[column] === "undefined" || clean[column] === null ? "" : clean[column];
    return acc;
  }, {});
}

function createMissingCapacitacionRow(document, index = 0) {
  const archivo = document && document.archivo ? document.archivo : {};
  const identificacion = document && document.identificacion ? document.identificacion : {};
  const idDocumento = document ? document.id_documento : "";

  return normalizeCapacitacionRow({
    id: idDocumento ? createRowId("capacitacion", idDocumento, 0, "sin-capacitacion-detectada") : "",
    id_documento: idDocumento,
    codigo_documento: archivo.codigo_documento || identificacion.codigo_documento || "",
    nombre_docente: identificacion.nombre_docente || "",
    carrera: identificacion.carrera || "",
    numero_capacitacion: 1,
    nombre_capacitacion: "",
    horas_capacitacion: "",
    fecha_inicio_capacitacion: "",
    fecha_fin_capacitacion: "",
    fecha_texto_original: "",
    tipo_capacitacion: "",
    requiere_revision: "SI",
    observacion_extraccion: "No se detectaron capacitaciones propuestas en el documento."
  }, index);
}

function buildCapacitacionesTable(parsedDocuments) {
  const documents = Array.isArray(parsedDocuments) ? parsedDocuments : [];
  const rows = [];

  documents.forEach((document) => {
    const capacitaciones = document && Array.isArray(document.capacitaciones)
      ? document.capacitaciones
      : [];

    if (!capacitaciones.length) {
      rows.push(createMissingCapacitacionRow(document, rows.length));
      return;
    }

    capacitaciones.forEach((row) => {
      rows.push(normalizeCapacitacionRow(row, rows.length));
    });
  });

  return rows;
}

function buildCapacitacionesTableFromParseResult(parseResult) {
  const parsedDocuments = parseResult && Array.isArray(parseResult.parsed)
    ? parseResult.parsed
    : [];

  return buildCapacitacionesTable(parsedDocuments);
}

function validateCapacitacionesTable(rows) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];

  data.forEach((row, index) => {
    if (!row.id_documento) warnings.push(`Fila ${index + 1}: falta id_documento.`);
    if (!row.nombre_docente) warnings.push(`Fila ${index + 1}: falta nombre_docente.`);
    if (!row.nombre_capacitacion) warnings.push(`Fila ${index + 1}: falta nombre_capacitacion.`);
    if (hasSuspiciousDate(row)) warnings.push(`Fila ${index + 1}: fecha sospechosa.`);
  });

  return {
    ok: warnings.length === 0,
    totalRows: data.length,
    warningCount: warnings.length,
    warnings
  };
}

module.exports = {
  CAPACITACIONES_COLUMNS,
  emptyRow,
  hasSuspiciousDate,
  normalizeCapacitacionRow,
  buildCapacitacionesTable,
  buildCapacitacionesTableFromParseResult,
  validateCapacitacionesTable
};
