/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/index.js
Función o funciones:
- Centralizar definición, lector híbrido, parser, tablas y validaciones.
- Exponer el procesador especializado de Acuerdos de Patrocinio.
- Configurar OCR automático para documentos escaneados.
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
      minCharacters: 180,
      minWords: 25
    },
    ocr: {
      languages: ["spa", "eng"],
      scale: 2.2,
      maxPages: 10
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
