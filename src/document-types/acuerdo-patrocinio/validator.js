/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/acuerdo-patrocinio/validator.js
Función o funciones:
- Validar documentos parseados de Acuerdos de Patrocinio.
- Comprobar código, docente, cédula, capacitación y apoyo marcado.
- Confirmar que se generen las cuatro tablas obligatorias.
========================================================= */

"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const data = document || {};
  const archivo = data.archivo || {};
  const acuerdo = data.datos_acuerdo || {};
  const apoyos = Array.isArray(data.apoyos) ? data.apoyos : [];
  const responsables = Array.isArray(data.responsables) ? data.responsables : [];
  const warnings = [];

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (data.document_type !== definition.id) warnings.push("El tipo documental no coincide con Acuerdo de Patrocinio.");
  if (!/(?:UGPA|CGC)-RGI2-\d{1,3}-PRO-134-\d{4}-\d{2}/i.test(archivo.codigo_documento || "")) {
    warnings.push("No se detectó un código institucional PRO-134 válido.");
  }
  if (!acuerdo.nombre_docente) warnings.push("No se detectó nombre del docente.");
  if (!acuerdo.cedula_docente) warnings.push("No se detectó cédula del docente.");
  if (!acuerdo.nombre_capacitacion) warnings.push("No se detectó nombre de la capacitación.");
  if (!acuerdo.fecha_acuerdo) warnings.push("No se detectó fecha completa del acuerdo.");
  if (!apoyos.some((row) => row.seleccionado === "SI")) warnings.push("No se detectó apoyo institucional marcado.");
  if (!responsables.length) warnings.push("No se detectaron responsables del acuerdo.");
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
  const warnings = [
    ...missingTables.map((tableName) => `No se construyó la tabla ${tableName}.`),
    ...emptyTables.map((tableName) => `La tabla ${tableName} quedó vacía.`)
  ];

  return {
    ok: missingTables.length === 0 && emptyTables.length === 0,
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
