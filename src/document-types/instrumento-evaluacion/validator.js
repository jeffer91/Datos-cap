/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/validator.js
Función o funciones:
- Validar documentos parseados de Instrumentos de Evaluación.
- Comprobar código PRO-135, curso, participantes, indicadores y responsables.
- Confirmar que se generen las ocho tablas obligatorias.
========================================================= */

"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const data = document || {};
  const archivo = data.archivo || {};
  const general = data.datos_generales || {};
  const warnings = [];

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (data.document_type !== definition.id) warnings.push("El tipo documental no coincide con Instrumento de Evaluación.");
  if (!/UGPA-RGI1-\d{1,3}-PRO-135-\d{4}-\d{2}/i.test(archivo.codigo_documento || "")) warnings.push("No se detectó un código UGPA-RGI1 de PRO-135 válido.");
  if (!general.nombre_curso) warnings.push("No se detectó nombre del curso.");
  if (!general.facilitador) warnings.push("No se detectó facilitador.");
  if (!Array.isArray(data.participantes) || !data.participantes.length) warnings.push("No se detectaron participantes.");
  if (!Array.isArray(data.indicadores) || !data.indicadores.some((row) => row.resultado_texto)) warnings.push("No se detectaron indicadores con resultado.");
  if (!Array.isArray(data.likert) || !data.likert.length) warnings.push("No se construyó la escala Likert.");
  if (!Array.isArray(data.objetivos) || !data.objetivos.length) warnings.push("No se detectaron objetivos de aprendizaje.");
  if (!Array.isArray(data.responsables) || !data.responsables.length) warnings.push("No se detectaron responsables.");
  if (!data.source || !data.source.file_hash) warnings.push("No se conserva la huella del archivo origen.");

  return { ok: warnings.length === 0, documentId: data.id_documento || "", warnings };
}

function validateParseResult(parseResult) {
  const documents = parseResult && Array.isArray(parseResult.parsed) ? parseResult.parsed : [];
  const documentChecks = documents.map(validateParsedDocument);
  const warnings = documentChecks.flatMap((check) => check.warnings.map((advertencia) => ({ documento: check.documentId, advertencia })));
  return { ok: documents.length > 0 && warnings.length === 0, parsedCount: documents.length, warningCount: warnings.length, documentChecks, warnings };
}

function validateTableResult(tableResult) {
  const tables = tableResult && tableResult.tables ? tableResult.tables : {};
  const expectedNames = definition.tables.map((table) => table.name);
  const missingTables = expectedNames.filter((name) => !Array.isArray(tables[name]));
  const emptyTables = expectedNames.filter((name) => Array.isArray(tables[name]) && tables[name].length === 0);
  const warnings = [
    ...missingTables.map((name) => `No se construyó la tabla ${name}.`),
    ...emptyTables.map((name) => `La tabla ${name} quedó vacía.`)
  ];
  return { ok: missingTables.length === 0 && emptyTables.length === 0, expectedTableCount: expectedNames.length, actualTableCount: Object.keys(tables).length, missingTables, emptyTables, warnings };
}

module.exports = { validateParsedDocument, validateParseResult, validateTableResult };
