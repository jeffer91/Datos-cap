/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/planificacion-capacitacion/validator.js
Función o funciones:
- Validar documentos y tablas de Planificación de Capacitación.
========================================================= */
"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const data = document || {};
  const file = data.archivo || {};
  const general = data.datos_generales || {};
  const warnings = [];

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (data.document_type !== definition.id) warnings.push("El tipo documental no coincide con Planificación de Capacitación.");
  if (!/UGPA-RGI1-\d{1,3}-PRO-134-\d{4}-\d{2}/i.test(file.codigo_documento || "")) {
    warnings.push("No se detectó un código RGI1 PRO-134 válido.");
  }
  if (!general.nombre_curso) warnings.push("No se detectó el nombre del curso.");
  if (!general.carrera_publico) warnings.push("No se detectó la carrera o público objetivo.");
  if (!(data.unidades || []).length) warnings.push("No se detectaron unidades del temario.");
  if (!data.source || !data.source.file_hash) warnings.push("No se conserva la huella del archivo origen.");

  return { ok: warnings.length === 0, documentId: data.id_documento || "", warnings };
}

function validateParseResult(parseResult) {
  const documents = Array.isArray(parseResult?.parsed) ? parseResult.parsed : [];
  const documentChecks = documents.map(validateParsedDocument);
  const warnings = documentChecks.flatMap((check) =>
    check.warnings.map((warning) => ({ documento: check.documentId, advertencia: warning }))
  );
  return {
    ok: documents.length > 0 && warnings.length === 0,
    parsedCount: documents.length,
    warningCount: warnings.length,
    documentChecks,
    warnings
  };
}

module.exports = {
  validateParsedDocument,
  validateParseResult
};
