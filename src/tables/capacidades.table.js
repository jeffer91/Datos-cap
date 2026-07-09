/* =========================================================
Nombre completo: capacidades.table.js
Ruta o ubicación: /plan-docente-extractor/src/tables/capacidades.table.js
Función o funciones:
- Construir la tabla no relacional capacidades_docente.
- Normalizar respuestas variables del diagnóstico/capacidades del docente.
- Mantener una fila por documento/docente.
- Marcar registros con poca información para revisión.
========================================================= */

"use strict";

const { createRowId } = require("../utils/ids");

const CAPACIDADES_COLUMNS = [
  "id",
  "id_documento",
  "codigo_documento",
  "nombre_docente",
  "carrera",
  "curso_actualizacion_ultimos_12_meses",
  "avances_disciplinares_aplicados",
  "comodidad_metodologias_nuevas",
  "estrategias_pedagogicas",
  "herramientas_tecnologicas",
  "formacion_adicional_necesaria",
  "nivel_academico_actual",
  "tipo_formacion_propuesta",
  "requiere_revision",
  "observacion_extraccion"
];

const VARIABLE_FIELDS = [
  "curso_actualizacion_ultimos_12_meses",
  "avances_disciplinares_aplicados",
  "comodidad_metodologias_nuevas",
  "estrategias_pedagogicas",
  "herramientas_tecnologicas",
  "formacion_adicional_necesaria",
  "nivel_academico_actual",
  "tipo_formacion_propuesta"
];

function emptyRow() {
  return {
    id: "",
    id_documento: "",
    codigo_documento: "",
    nombre_docente: "",
    carrera: "",
    curso_actualizacion_ultimos_12_meses: "",
    avances_disciplinares_aplicados: "",
    comodidad_metodologias_nuevas: "",
    estrategias_pedagogicas: "",
    herramientas_tecnologicas: "",
    formacion_adicional_necesaria: "",
    nivel_academico_actual: "",
    tipo_formacion_propuesta: "",
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

function countDetectedVariableFields(row) {
  return VARIABLE_FIELDS.reduce((total, field) => {
    return cleanText(row[field]) ? total + 1 : total;
  }, 0);
}

function normalizeCapacidadesRow(row, index = 0) {
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

  if (!clean.id && clean.id_documento) {
    clean.id = createRowId("capacidades", clean.id_documento, index, clean.nombre_docente);
  }

  const detectedCount = countDetectedVariableFields(clean);
  const missingBase = [];

  if (!clean.id_documento) missingBase.push("id_documento");
  if (!clean.codigo_documento) missingBase.push("codigo_documento");
  if (!clean.nombre_docente) missingBase.push("nombre_docente");
  if (!clean.carrera) missingBase.push("carrera");

  if (missingBase.length || detectedCount === 0) {
    clean.requiere_revision = "SI";

    if (!clean.observacion_extraccion) {
      const messages = [];

      if (missingBase.length) {
        messages.push(`Campos base faltantes: ${missingBase.join(", ")}.`);
      }

      if (detectedCount === 0) {
        messages.push("No se detectaron respuestas variables de capacidades docentes.");
      }

      clean.observacion_extraccion = messages.join(" ");
    }
  } else {
    clean.requiere_revision = clean.requiere_revision === "SI" ? "SI" : "NO";
  }

  return CAPACIDADES_COLUMNS.reduce((acc, column) => {
    acc[column] = typeof clean[column] === "undefined" || clean[column] === null ? "" : clean[column];
    return acc;
  }, {});
}

function buildCapacidadesTable(parsedDocuments) {
  const documents = Array.isArray(parsedDocuments) ? parsedDocuments : [];

  return documents.map((document, index) => {
    return normalizeCapacidadesRow(document ? document.capacidades : null, index);
  });
}

function buildCapacidadesTableFromParseResult(parseResult) {
  const parsedDocuments = parseResult && Array.isArray(parseResult.parsed)
    ? parseResult.parsed
    : [];

  return buildCapacidadesTable(parsedDocuments);
}

function validateCapacidadesTable(rows) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];

  data.forEach((row, index) => {
    if (!row.id_documento) warnings.push(`Fila ${index + 1}: falta id_documento.`);
    if (!row.nombre_docente) warnings.push(`Fila ${index + 1}: falta nombre_docente.`);

    const detectedCount = countDetectedVariableFields(row);

    if (detectedCount === 0) {
      warnings.push(`Fila ${index + 1}: no tiene respuestas variables detectadas.`);
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
  CAPACIDADES_COLUMNS,
  VARIABLE_FIELDS,
  emptyRow,
  countDetectedVariableFields,
  normalizeCapacidadesRow,
  buildCapacidadesTable,
  buildCapacidadesTableFromParseResult,
  validateCapacidadesTable
};
