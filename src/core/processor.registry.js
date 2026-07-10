/* =========================================================
Nombre completo: processor.registry.js
Ruta o ubicación: /src/core/processor.registry.js
Función o funciones:
- Registrar los procesadores especializados disponibles.
- Resolver un procesador por identificador de tipo documental.
- Impedir que el núcleo dependa directamente de parsers concretos.
========================================================= */

"use strict";

const processors = [
  require("../document-types/plan-individual")
];

const registry = new Map(processors.map((processor) => [processor.id, processor]));

function getProcessor(documentTypeId) {
  return registry.get(String(documentTypeId || "").trim()) || null;
}

function hasProcessor(documentTypeId) {
  return registry.has(String(documentTypeId || "").trim());
}

function assertProcessor(documentTypeId) {
  const processor = getProcessor(documentTypeId);

  if (!processor) {
    throw new Error(`No existe un procesador implementado para ${documentTypeId || "el tipo solicitado"}.`);
  }

  return processor;
}

function listProcessorIds() {
  return Array.from(registry.keys());
}

module.exports = {
  getProcessor,
  hasProcessor,
  assertProcessor,
  listProcessorIds
};
