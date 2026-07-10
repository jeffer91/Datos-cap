/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/informe-impacto/index.js
Función o funciones:
- Centralizar definición, lector híbrido, parser, tablas y validaciones.
- Exponer el procesador especializado del Informe de Impacto.
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
    quality: { minCharacters: 300, minWords: 45 },
    ocr: { languages: ["spa", "eng"], scale: 2.2, maxPages: 40 }
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
