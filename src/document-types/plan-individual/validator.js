/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/plan-individual/validator.js
Función o funciones:
- Validar el resultado del parser del Plan Individual.
- Confirmar que existan las cinco tablas declaradas.
- Detectar documentos con código, docente o carrera faltantes.
- Entregar advertencias uniformes al procesador documental.
========================================================= */

"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const warnings = [];
  const data = document || {};
  const archivo = data.archivo || {};
  const identificacion = data.identificacion || {};

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (!archivo.codigo_documento) warnings.push("No se detectó código documental.");
  if (!identificacion.nombre_docente) warnings.push("No se detectó nombre del docente.");
  if (!identificacion.carrera) warnings.push("No se detectó carrera.");
  if (!data.capacidades) warnings.push("No se construyó el bloque de capacidades.");
  if (!Array.isArray(data.capacitaciones)) warnings.push("El bloque de capacitaciones no es una lista válida.");
  if (!Array.isArray(data.formacion)) warnings.push("El bloque de formación no es una lista válida.");

  return {
    ok: warnings.length === 0,
    documentId: data.id_documento || "",
    warnings
  };
}

function validateParseResult(parseResult) {
  const result = parseResult || {};
  const documents = Array.isArray(result.parsed) ? result.parsed : [];
  const documentChecks = documents.map(validateParsedDocument);
  const warnings = documentChecks.flatMap((check) => check.warnings.map((warning) => ({
    documento: check.documentId,
    advertencia: warning
  })));

  return {
    ok: documents.length > 0 && warnings.length === 0,
    parsedCount: documents.length,
    warningCount: warnings.length,
    documentChecks,
    warnings
  };
}

function validateTableResult(tableResult) {
  const result = tableResult || {};
  const tables = result.tables || {};
  const expectedNames = definition.tables.map((table) => table.name);
  const missingTables = expectedNames.filter((tableName) => !Array.isArray(tables[tableName]));
  const emptyTables = expectedNames.filter((tableName) => Array.isArray(tables[tableName]) && tables[tableName].length === 0);
  const warnings = [
    ...missingTables.map((tableName) => `No se construyó la tabla ${tableName}.`),
    ...emptyTables.map((tableName) => `La tabla ${tableName} quedó vacía.`)
  ];

  return {
    ok: missingTables.length === 0,
    expectedTableCount: expectedNames.length,
    actualTableCount: Object.keys(tables).length,
    missingTables,
    emptyTables,
    warnings
  };
}

module.exports = {
  validateParsedDocument,
  validateParseResult,
  validateTableResult
};
