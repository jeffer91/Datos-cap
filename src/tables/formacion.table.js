/* =========================================================
Nombre completo: formacion.table.js
Ruta o ubicación: /plan-docente-extractor/src/tables/formacion.table.js
Función o funciones:
- Construir la tabla no relacional formacion_docente.
- Permitir una o varias formaciones por documento/docente.
- Normalizar situación actual, propuesta, tiempo esperado y nivel académico.
- Marcar registros sin detalle de formación para revisión.
========================================================= */

"use strict";

const { createRowId } = require("../utils/ids");

const FORMACION_COLUMNS = [
  "id",
  "id_documento",
  "codigo_documento",
  "nombre_docente",
  "carrera",
  "numero_formacion",
  "situacion_actual_formacion",
  "situacion_propuesta_formacion",
  "tiempo_esperado_cumplimiento",
  "nombre_formacion",
  "nivel_academico_formacion",
  "tipo_formacion",
  "fecha_inicio_formacion",
  "fecha_fin_formacion",
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
    numero_formacion: "",
    situacion_actual_formacion: "",
    situacion_propuesta_formacion: "",
    tiempo_esperado_cumplimiento: "",
    nombre_formacion: "",
    nivel_academico_formacion: "",
    tipo_formacion: "",
    fecha_inicio_formacion: "",
    fecha_fin_formacion: "",
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

function inferNivelAcademico(value) {
  const text = cleanText(value).toLowerCase();

  if (text.includes("doctorado")) return "Doctorado";
  if (text.includes("maestr") || text.includes("magíster") || text.includes("magister")) return "Maestría";
  if (text.includes("diplomado")) return "Diplomado";
  if (text.includes("licenciatura") || text.includes("ingenier")) return "Licenciatura / Ingeniería";
  if (text.includes("tecnolog")) return "Tecnología Superior";
  if (text.includes("posgrado")) return "Posgrado";
  if (text.includes("curso")) return "Curso";

  return "";
}

function inferTipoFormacion(value) {
  const text = cleanText(value).toLowerCase();

  if (text.includes("genérica") || text.includes("generica")) return "Genérica";
  if (text.includes("específica") || text.includes("especifica")) return "Específica";

  return "";
}

function normalizeFormacionRow(row, index = 0) {
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

  if (!clean.numero_formacion) {
    clean.numero_formacion = index + 1;
  }

  if (!clean.nivel_academico_formacion && clean.nombre_formacion) {
    clean.nivel_academico_formacion = inferNivelAcademico(clean.nombre_formacion);
  }

  if (!clean.tipo_formacion && clean.nombre_formacion) {
    clean.tipo_formacion = inferTipoFormacion(clean.nombre_formacion);
  }

  if (!clean.id && clean.id_documento) {
    clean.id = createRowId("formacion", clean.id_documento, index, clean.nombre_formacion);
  }

  const missing = [];

  if (!clean.id_documento) missing.push("id_documento");
  if (!clean.codigo_documento) missing.push("codigo_documento");
  if (!clean.nombre_docente) missing.push("nombre_docente");
  if (!clean.nombre_formacion && !clean.situacion_actual_formacion && !clean.situacion_propuesta_formacion) {
    missing.push("detalle_formacion");
  }

  if (missing.length) {
    clean.requiere_revision = "SI";

    if (!clean.observacion_extraccion) {
      clean.observacion_extraccion = `Campos faltantes: ${missing.join(", ")}.`;
    }
  } else {
    clean.requiere_revision = clean.requiere_revision === "SI" ? "SI" : "NO";
  }

  return FORMACION_COLUMNS.reduce((acc, column) => {
    acc[column] = typeof clean[column] === "undefined" || clean[column] === null ? "" : clean[column];
    return acc;
  }, {});
}

function createMissingFormacionRow(document, index = 0) {
  const archivo = document && document.archivo ? document.archivo : {};
  const identificacion = document && document.identificacion ? document.identificacion : {};
  const idDocumento = document ? document.id_documento : "";

  return normalizeFormacionRow({
    id: idDocumento ? createRowId("formacion", idDocumento, 0, "sin-formacion-detectada") : "",
    id_documento: idDocumento,
    codigo_documento: archivo.codigo_documento || identificacion.codigo_documento || "",
    nombre_docente: identificacion.nombre_docente || "",
    carrera: identificacion.carrera || "",
    numero_formacion: 1,
    situacion_actual_formacion: "",
    situacion_propuesta_formacion: "",
    tiempo_esperado_cumplimiento: "",
    nombre_formacion: "",
    nivel_academico_formacion: "",
    tipo_formacion: "",
    fecha_inicio_formacion: "",
    fecha_fin_formacion: "",
    requiere_revision: "SI",
    observacion_extraccion: "No se detectó información de formación docente en el documento."
  }, index);
}

function buildFormacionTable(parsedDocuments) {
  const documents = Array.isArray(parsedDocuments) ? parsedDocuments : [];
  const rows = [];

  documents.forEach((document) => {
    const formacion = document && Array.isArray(document.formacion)
      ? document.formacion
      : [];

    if (!formacion.length) {
      rows.push(createMissingFormacionRow(document, rows.length));
      return;
    }

    formacion.forEach((row) => {
      rows.push(normalizeFormacionRow(row, rows.length));
    });
  });

  return rows;
}

function buildFormacionTableFromParseResult(parseResult) {
  const parsedDocuments = parseResult && Array.isArray(parseResult.parsed)
    ? parseResult.parsed
    : [];

  return buildFormacionTable(parsedDocuments);
}

function validateFormacionTable(rows) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];

  data.forEach((row, index) => {
    if (!row.id_documento) warnings.push(`Fila ${index + 1}: falta id_documento.`);
    if (!row.nombre_docente) warnings.push(`Fila ${index + 1}: falta nombre_docente.`);
    if (!row.nombre_formacion && !row.situacion_actual_formacion && !row.situacion_propuesta_formacion) {
      warnings.push(`Fila ${index + 1}: falta detalle de formación.`);
    }
  });

  return {
    ok: warnings.length === 0,
    totalRows: data.length,
    warningCount: warnings.length,
    warnings
  };
}

module.exports = {
  FORMACION_COLUMNS,
  emptyRow,
  inferNivelAcademico,
  inferTipoFormacion,
  normalizeFormacionRow,
  buildFormacionTable,
  buildFormacionTableFromParseResult,
  validateFormacionTable
};
