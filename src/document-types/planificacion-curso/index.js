/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/planificacion-curso/index.js
Función o funciones:
- Centralizar definición, lector híbrido, parser, tablas y validaciones.
- Exponer el procesador especializado de Planificación por Curso.
- Configurar OCR automático para PDF escaneados.
========================================================= */

"use strict";

const definition = require("./definition");
const parser = require("./parser");
const tables = require("./tables");
const validator = require("./validator");
const { readPdfFilesHybrid } = require("../../readers/pdf-hybrid.reader");

async function readDocuments(filePaths) {
  return readPdfFilesHybrid(filePaths, {
    quality: {
      minCharacters: 220,
      minWords: 35
    },
    ocr: {
      languages: ["spa", "eng"],
      scale: 2.2,
      maxPages: 30
    }
  });
}

module.exports = Object.freeze({
  id: definition.id,
  version: "1.0.0",
  definition,
  readDocuments,
  parseDocuments: parser.parseDocuments,
  buildTables: tables.buildTables,
  flattenWarnings: tables.flattenWarnings,
  validateParseResult: validator.validateParseResult,
  validateTableResult: validator.validateTableResult
});
