/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/plan-general-capacitacion/validator.js
Función o funciones:
- Validar el documento único Plan Semestral de Capacitación.
- Comprobar código PRO-70, periodo, objetivos y acciones planificadas.
- Confirmar la generación de las ocho tablas obligatorias.
========================================================= */

"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const data = document || {};
  const archivo = data.archivo || {};
  const general = data.datos_generales || {};
  const warnings = [];

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (data.document_type !== definition.id) warnings.push("El tipo documental no coincide con Plan General de Capacitación.");
  if (!/(?:UGPA|CGC)-RGI2-\d{1,3}-PRO-70-\d{4}-\d{2}/i.test(archivo.codigo_documento || "")) warnings.push("No se detectó un código RGI2 de PRO-70 válido.");
  if (!general.periodo_documental_texto) warnings.push("No se detectó el alcance temporal del plan.");
  if (!Array.isArray(data.objetivos) || !data.objetivos.length) warnings.push("No se detectaron objetivos.");
  if (!Array.isArray(data.capacitaciones) || !data.capacitaciones.length) warnings.push("No se detectaron capacitaciones planificadas.");
  if (!Array.isArray(data.cronograma) || !data.cronograma.length) warnings.push("No se construyó el cronograma.");
  if (!Array.isArray(data.seguimiento) || !data.seguimiento.length) warnings.push("No se detectaron indicadores de seguimiento.");
  if (!Array.isArray(data.recursos) || !data.recursos.length) warnings.push("No se detectaron recursos o presupuesto.");
  if (!Array.isArray(data.responsables) || !data.responsables.length) warnings.push("No se detectaron responsables.");
  if (!data.source || !data.source.file_hash) warnings.push("No se conserva la huella del archivo origen.");

  return { ok: warnings.length === 0, documentId: data.id_documento || "", warnings };
}

function validateParseResult(parseResult) {
  const documents = parseResult && Array.isArray(parseResult.parsed) ? parseResult.parsed : [];
  const documentChecks = documents.map(validateParsedDocument);
  const warnings = documentChecks.flatMap((check) => check.warnings.map((advertencia) => ({ documento: check.documentId, advertencia })));

  if (documents.length > 1) warnings.push({ documento: "", advertencia: "Solo se admite un Plan Semestral de Capacitación por operación y periodo." });

  return {
    ok: documents.length === 1 && warnings.length === 0,
    parsedCount: documents.length,
    warningCount: warnings.length,
    uniqueDocumentRule: documents.length === 1,
    documentChecks,
    warnings
  };
}

function validateTableResult(tableResult) {
  const tables = tableResult && tableResult.tables ? tableResult.tables : {};
  const expectedNames = definition.tables.map((table) => table.name);
  const missingTables = expectedNames.filter((name) => !Array.isArray(tables[name]));
  const emptyTables = expectedNames.filter((name) => Array.isArray(tables[name]) && tables[name].length === 0);
  const multipleFileRows = Array.isArray(tables.archivos_plan_general_capacitacion) && tables.archivos_plan_general_capacitacion.length > 1;
  const warnings = [
    ...missingTables.map((name) => `No se construyó la tabla ${name}.`),
    ...emptyTables.map((name) => `La tabla ${name} quedó vacía.`),
    ...(multipleFileRows ? ["La tabla de archivos contiene más de un documento único."] : [])
  ];

  return {
    ok: missingTables.length === 0 && emptyTables.length === 0 && !multipleFileRows,
    expectedTableCount: expectedNames.length,
    actualTableCount: Object.keys(tables).length,
    missingTables,
    emptyTables,
    multipleFileRows,
    warnings
  };
}

module.exports = { validateParsedDocument, validateParseResult, validateTableResult };
