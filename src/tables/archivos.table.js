/* =========================================================
Nombre completo: archivos.table.js
Ruta o ubicación: /plan-docente-extractor/src/tables/archivos.table.js
Función o funciones:
- Construir la tabla no relacional archivos_plan_individual.
- Convertir documentos parseados en filas limpias para Excel y JSON.
- Mantener trazabilidad por id_documento, código, periodo y archivo origen.
- Marcar registros que requieren revisión sin detener la exportación.
========================================================= */

"use strict";

const { createRowId } = require("../utils/ids");

const ARCHIVOS_COLUMNS = [
  "id",
  "id_documento",
  "nombre_archivo",
  "ruta_archivo",
  "codigo_documento",
  "numero_registro",
  "periodo",
  "anio_periodo",
  "mes_periodo",
  "total_paginas",
  "estado_extraccion",
  "requiere_revision",
  "observacion_extraccion"
];

function emptyRow() {
  return {
    id: "",
    id_documento: "",
    nombre_archivo: "",
    ruta_archivo: "",
    codigo_documento: "",
    numero_registro: "",
    periodo: "",
    anio_periodo: "",
    mes_periodo: "",
    total_paginas: 0,
    estado_extraccion: "REVISAR",
    requiere_revision: "SI",
    observacion_extraccion: ""
  };
}

function normalizeArchivoRow(row, index = 0) {
  const base = emptyRow();
  const clean = {
    ...base,
    ...(row || {})
  };

  if (!clean.id && clean.id_documento) {
    clean.id = createRowId("archivo", clean.id_documento, index, clean.nombre_archivo);
  }

  if (!clean.estado_extraccion) {
    clean.estado_extraccion = clean.requiere_revision === "SI" ? "REVISAR" : "OK";
  }

  if (!clean.requiere_revision) {
    clean.requiere_revision = clean.estado_extraccion === "OK" ? "NO" : "SI";
  }

  clean.total_paginas = Number(clean.total_paginas || 0);

  return ARCHIVOS_COLUMNS.reduce((acc, column) => {
    acc[column] = typeof clean[column] === "undefined" || clean[column] === null ? "" : clean[column];
    return acc;
  }, {});
}

function buildArchivosTable(parsedDocuments) {
  const documents = Array.isArray(parsedDocuments) ? parsedDocuments : [];

  return documents.map((document, index) => {
    return normalizeArchivoRow(document ? document.archivo : null, index);
  });
}

function buildArchivosTableFromParseResult(parseResult) {
  const parsedDocuments = parseResult && Array.isArray(parseResult.parsed)
    ? parseResult.parsed
    : [];

  return buildArchivosTable(parsedDocuments);
}

function validateArchivosTable(rows) {
  const data = Array.isArray(rows) ? rows : [];
  const warnings = [];

  data.forEach((row, index) => {
    if (!row.id_documento) {
      warnings.push(`Fila ${index + 1}: falta id_documento.`);
    }

    if (!row.nombre_archivo) {
      warnings.push(`Fila ${index + 1}: falta nombre_archivo.`);
    }

    if (!row.codigo_documento) {
      warnings.push(`Fila ${index + 1}: falta codigo_documento.`);
    }

    if (!row.periodo) {
      warnings.push(`Fila ${index + 1}: falta periodo.`);
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
  ARCHIVOS_COLUMNS,
  emptyRow,
  normalizeArchivoRow,
  buildArchivosTable,
  buildArchivosTableFromParseResult,
  validateArchivosTable
};
