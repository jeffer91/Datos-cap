/* =========================================================
Nombre completo: identificacion.table.js
Ruta o ubicación: /plan-docente-extractor/src/tables/identificacion.table.js
Función o funciones:
- Construir la tabla no relacional identificacion_docente.
- Normalizar datos base del docente extraídos desde cada PDF.
- Mantener trazabilidad por id_documento, código documental y archivo origen.
- Marcar registros incompletos para revisión sin bloquear la exportación.
========================================================= */

"use strict";

const { createRowId } = require("../utils/ids");

const IDENTIFICACION_COLUMNS = [
  "id",
  "id_documento",
  "codigo_documento",
  "nombre_docente",
  "tiempo_dedicacion",
  "carrera",
  "funcion_sustantiva",
  "nombre_firma_docente",
  "nombre_aprobador",
  "cargo_aprobador",
  "requiere_revision",
  "observacion_extraccion"
];

function emptyRow() {
  return {
    id: "",
    id_documento: "",
    codigo_documento: "",
    nombre_docente: "",
    tiempo_dedicacion: "",
    carrera: "",
    funcion_sustantiva: "",
    nombre_firma_docente: "",
    nombre_aprobador: "",
    cargo_aprobador: "",
    requiere_revision: "SI",
    observacion_extraccion: ""
  };
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeRevision(row) {
  const missing = [];

  if (!cleanText(row.id_documento)) missing.push("id_documento");
  if (!cleanText(row.codigo_documento)) missing.push("codigo_documento");
  if (!cleanText(row.nombre_docente)) missing.push("nombre_docente");
  if (!cleanText(row.carrera)) missing.push("carrera");
  if (!cleanText(row.tiempo_dedicacion)) missing.push("tiempo_dedicacion");
  if (!cleanText(row.funcion_sustantiva)) missing.push("funcion_sustantiva");

  if (missing.length) {
    return {
      requiere_revision: "SI",
      observacion_extraccion: `Campos faltantes: ${missing.join(", ")}.`
    };
  }

  return {
    requiere_revision: "NO",
    observacion_extraccion: ""
  };
}

function normalizeIdentificacionRow(row, index = 0) {
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

  if (!clean.nombre_firma_docente && clean.nombre_docente) {
    clean.nombre_firma_docente = clean.nombre_docente;
  }

  if (!clean.id && clean.id_documento) {
    clean.id = createRowId("identificacion", clean.id_documento, index, clean.nombre_docente);
  }

  const revision = normalizeRevision(clean);

  if (!clean.observacion_extraccion) {
    clean.observacion_extraccion = revision.observacion_extraccion;
  }

  clean.requiere_revision = clean.requiere_revision === "SI" || revision.requiere_revision === "SI" ? "SI" : "NO";

  return IDENTIFICACION_COLUMNS.reduce((acc, column) => {
    acc[column] = typeof clean[column] === "undefined" || clean[column] === null ? "" : clean[column];
    return acc;
  }, {});
}

function buildIdentificacionTable(parsedDocuments) {
  const documents = Array.isArray(parsedDocuments) ? parsedDocuments : [];

  return documents.map((document, index) => {
    return normalizeIdentificacionRow(document ? document.identificacion : null, index);
  });
}

function buildIdentificacionTableFromParseResult(parseResult) {
  const parsedDocuments = parseResult && Array.isArray(parseResult.parsed)
    ? parseResult.parsed
    : [];

  return buildIdentificacionTable(parsedDocuments);
}

function validateIdentificacionTable(rows) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];

  data.forEach((row, index) => {
    if (!row.id_documento) warnings.push(`Fila ${index + 1}: falta id_documento.`);
    if (!row.codigo_documento) warnings.push(`Fila ${index + 1}: falta codigo_documento.`);
    if (!row.nombre_docente) warnings.push(`Fila ${index + 1}: falta nombre_docente.`);
    if (!row.carrera) warnings.push(`Fila ${index + 1}: falta carrera.`);
    if (!row.tiempo_dedicacion) warnings.push(`Fila ${index + 1}: falta tiempo_dedicacion.`);
    if (!row.funcion_sustantiva) warnings.push(`Fila ${index + 1}: falta funcion_sustantiva.`);
  });

  return {
    ok: warnings.length === 0,
    totalRows: data.length,
    warningCount: warnings.length,
    warnings
  };
}

module.exports = {
  IDENTIFICACION_COLUMNS,
  emptyRow,
  normalizeIdentificacionRow,
  buildIdentificacionTable,
  buildIdentificacionTableFromParseResult,
  validateIdentificacionTable
};
