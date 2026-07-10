/* =========================================================
Nombre completo: validator.js
Ruta o ubicación: /src/document-types/informe-final/validator.js
Función o funciones:
- Validar documentos parseados de Informes Finales de Capacitación.
- Comprobar código, curso, fechas, participantes, resumen y responsables.
- Confirmar que se generen las seis tablas obligatorias.
========================================================= */

"use strict";

const definition = require("./definition");

function validateParsedDocument(document) {
  const data = document || {};
  const archivo = data.archivo || {};
  const generales = data.datos_generales || {};
  const participantes = Array.isArray(data.participantes) ? data.participantes : [];
  const resultados = Array.isArray(data.resultados) ? data.resultados : [];
  const responsables = Array.isArray(data.responsables) ? data.responsables : [];
  const resumen = data.resumen || {};
  const warnings = [];

  if (!data.id_documento) warnings.push("El documento no tiene identificador estable.");
  if (data.document_type !== definition.id) warnings.push("El tipo documental no coincide con Informe Final.");
  if (!/UGPA-INF-\d{1,3}-PRO-134-\d{4}-\d{2}/i.test(archivo.codigo_documento || "")) {
    warnings.push("No se detectó un código UGPA-INF de PRO-134 válido.");
  }
  if (!generales.nombre_capacitacion) warnings.push("No se detectó nombre de la capacitación.");
  if (!generales.facilitador) warnings.push("No se detectó facilitador.");
  if (!generales.fecha_inicio || !generales.fecha_fin) warnings.push("No se detectaron fechas completas de impartición.");
  if (!generales.duracion_horas) warnings.push("No se detectó duración en horas.");
  if (!participantes.length) warnings.push("No se detectaron participantes.");
  if (resultados.length !== participantes.length) warnings.push("La cantidad de resultados no coincide con los participantes.");
  if (resumen.total_inscritos === "") warnings.push("No se detectó el resumen de certificados.");
  if (resumen.total_inscritos !== "" && Number(resumen.total_inscritos) !== participantes.length) {
    warnings.push("El total de inscritos no coincide con la matriz de participantes.");
  }
  if (!responsables.length) warnings.push("No se detectaron responsables.");
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
