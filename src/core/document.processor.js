/* =========================================================
Nombre completo: document.processor.js
Ruta o ubicación: /src/core/document.processor.js
Función o funciones:
- Recibir solicitudes de cualquier apartado documental.
- Resolver el procesador especializado mediante un registro central.
- Ejecutar el pipeline genérico sin depender de parsers concretos.
- Bloquear de forma controlada módulos todavía no implementados.
========================================================= */

"use strict";

const { assertDocumentType } = require("./document-type.registry");
const { getProcessor } = require("./processor.registry");
const { processReport } = require("../processors/report.processor");

async function processDocument(options) {
  const config = options || {};
  const definition = assertDocumentType(config.documentType);
  const processor = getProcessor(definition.processorId || definition.id);

  if (!definition.enabled || !processor) {
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

  return processReport({
    ...config,
    definition,
    processor,
    baseName: config.baseName || undefined
  });
}

module.exports = {
  processDocument
};
