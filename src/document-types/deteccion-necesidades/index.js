/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/document-types/deteccion-necesidades/index.js
Función o funciones:
- Centralizar definición, lector híbrido, parser reforzado, tablas y validaciones.
- Exponer el procesador del documento único Detección de Necesidades.
- Configurar OCR para documentos institucionales extensos.
========================================================= */

"use strict";

const definition = require("./definition");
const parser = require("./parser.adapter");
const tables = require("./tables");
const validator = require("./validator");
const { readPdfFilesHybrid } = require("../../readers/pdf-hybrid.reader");

async function readDocuments(filePaths) {
  const paths = Array.isArray(filePaths) ? filePaths : [];
  if (paths.length > 1) {
    return [{
      ok: false,
      fileName: "",
      filePath: "",
      errors: ["Detección de Necesidades admite un solo PDF por operación y periodo."],
      warnings: []
    }];
  }

  return readPdfFilesHybrid(paths, {
    quality: { minCharacters: 500, minWords: 80 },
    ocr: { languages: ["spa", "eng"], scale: 2.0, maxPages: 220 }
  });
}

module.exports = Object.freeze({
  id: definition.id,
  version: "1.0.1",
  definition,
  readDocuments,
  parseDocuments: parser.parseDocuments,
  buildTables: tables.buildTables,
  flattenWarnings: tables.flattenWarnings,
  validateParseResult: validator.validateParseResult,
  validateTableResult: validator.validateTableResult
});
