/* =========================================================
Nombre completo: document.processor.js
Ruta o ubicación: /src/core/document.processor.js
Función o funciones:
- Recibir solicitudes de cualquier apartado documental.
- Seleccionar el procesador especializado registrado para cada tipo.
- Mantener funcionando el extractor actual de Plan Individual.
- Bloquear de forma controlada módulos todavía no implementados.
========================================================= */

"use strict";

const { assertDocumentType } = require("./document-type.registry");
const { processReport } = require("../processors/report.processor");

async function processDocument(options) {
  const config = options || {};
  const definition = assertDocumentType(config.documentType);

  if (!definition.enabled) {
    return {
      ok: false,
      code: "MODULE_NOT_IMPLEMENTED",
      documentType: definition.id,
      message: `El apartado ${definition.shortLabel} ya está registrado, pero su extractor específico todavía no ha sido implementado.`,
      files: {},
      summary: {},
      warnings: [],
      errors: []
    };
  }

  if (definition.processorId === "legacy-plan-individual") {
    return processReport({
      ...config,
      definition,
      baseName: config.baseName || undefined
    });
  }

  throw new Error(`No existe procesador para el tipo documental ${definition.id}.`);
}

module.exports = {
  processDocument
};
