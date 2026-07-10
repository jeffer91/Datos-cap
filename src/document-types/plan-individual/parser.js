/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/plan-individual/parser.js
Función o funciones:
- Exponer el parser especializado del Plan Individual.
- Mantener compatibilidad temporal con el extractor existente.
- Normalizar la respuesta para el procesador documental genérico.
========================================================= */

"use strict";

const legacyParser = require("../../extractor/fields.parser");

const DOCUMENT_TYPE = "plan-individual";

function parseDocument(pdfDocument) {
  return legacyParser.parsePdfDocument({
    ...(pdfDocument || {}),
    documentType: DOCUMENT_TYPE
  });
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
  parseDocument,
  parseDocuments,
  inferNivelAcademico: legacyParser.inferNivelAcademico,
  inferTipoFormacion: legacyParser.inferTipoFormacion
};
