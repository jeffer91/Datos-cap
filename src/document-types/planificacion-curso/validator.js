/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/planificacion-curso/validator.js
Función o funciones:
- Validar documentos parseados de Planificación de Capacitación.
- Comprobar código PRO-134, curso, unidades y evaluaciones.
- Confirmar que se generen las cuatro tablas obligatorias.
========================================================= */

"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const data = document || {};
  const archivo = data.archivo || {};
  const generales = data.datos_generales || {};
  const warnings = [];

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (data.document_type !== definition.id) warnings.push("El tipo documental no coincide con Planificación por Curso.");
  if (!/-PRO-134-/i.test(archivo.codigo_documento || "")) warnings.push("No se detectó un código PRO-134 válido.");
  if (!generales.nombre_curso) warnings.push("No se detectó nombre del curso.");
  if (!generales.descripcion_curso) warnings.push("No se detectó descripción del curso.");
  if (!Array.isArray(data.unidades) || data.unidades.length === 0) warnings.push("No se detectaron unidades del curso.");
  if (!Array.isArray(data.evaluaciones) || data.evaluaciones.length === 0) warnings.push("No se detectaron evaluaciones del curso.");
  if (!data.source || !data.source.file_hash) warnings.push("No se conserva la huella del archivo origen.");

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
  const criticalEmptyTables = emptyTables.filter((tableName) => tableName !== "evaluaciones_capacitacion");
  const warnings = [
    ...missingTables.map((tableName) => `No se construyó la tabla ${tableName}.`),
    ...emptyTables.map((tableName) => `La tabla ${tableName} quedó vacía.`)
  ];

  return {
    ok: missingTables.length === 0 && criticalEmptyTables.length === 0,
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
