/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/plan-individual/parser.js
Función o funciones:
- Exponer el parser especializado del Plan Individual.
- Mantener compatibilidad temporal con el extractor existente.
- Normalizar la respuesta para el procesador documental genérico.
- Conservar metadatos de huella y tipo documental.
========================================================= */

"use strict";

const legacyParser = require("../../extractor/fields.parser");

const DOCUMENT_TYPE = "plan-individual";

function enrichParsedDocument(parsedDocument, pdfDocument) {
  const parsed = parsedDocument || {};
  const source = pdfDocument || {};

  return {
    ...parsed,
    document_type: DOCUMENT_TYPE,
    source: {
      file_hash: source.fileHash || "",
      page_count: source.pageCount || 0,
      text_length: source.text ? source.text.length : 0
    }
  };
}

function parseDocument(pdfDocument) {
  const source = {
    ...(pdfDocument || {}),
    documentType: DOCUMENT_TYPE
  };
  const parsed = legacyParser.parsePdfDocument(source);
  return enrichParsedDocument(parsed, source);
}

function parseDocuments(pdfDocuments) {
  const documents = Array.isArray(pdfDocuments) ? pdfDocuments : [];
  const parsed = [];
  const errors = [];

  documents.forEach((document) => {
    if (!document || !document.ok) {
      errors.push({
        fileName: document ? document.fileName : "",
        errors: document && Array.isArray(document.errors)
          ? document.errors
          : ["Documento inválido."]
      });
      return;
    }

    try {
      parsed.push(parseDocument(document));
    } catch (error) {
      errors.push({
        fileName: document.fileName || "",
        errors: [error.message || "No se pudo analizar el Plan Individual."]
      });
    }
  });

  return {
    documentType: DOCUMENT_TYPE,
    total: documents.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
    parsed,
    errors
  };
}

module.exports = {
  DOCUMENT_TYPE,
  enrichParsedDocument,
  parseDocument,
  parseDocuments,
  inferNivelAcademico: legacyParser.inferNivelAcademico,
  inferTipoFormacion: legacyParser.inferTipoFormacion
};
