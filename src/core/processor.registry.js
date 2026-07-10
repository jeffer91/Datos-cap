/* =========================================================
Nombre completo: processor.registry.js
Ruta o ubicación: /src/core/processor.registry.js
Función o funciones:
- Registrar los procesadores especializados disponibles.
- Resolver un procesador por identificador de tipo documental.
- Impedir que el núcleo dependa directamente de parsers concretos.
- Informar versiones y cantidad de tablas de cada procesador.
========================================================= */

"use strict";

const processors = [
  require("../document-types/plan-individual"),
  require("../document-types/planificacion-curso"),
  require("../document-types/acuerdo-patrocinio"),
  require("../document-types/informe-final"),
  require("../document-types/instrumento-evaluacion"),
  require("../document-types/informe-impacto")
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
  if (!processor) throw new Error(`No existe un procesador implementado para ${documentTypeId || "el tipo solicitado"}.`);
  return processor;
}

function listProcessorIds() {
  return Array.from(registry.keys());
}

function listProcessors() {
  return Array.from(registry.values()).map((processor) => ({
    id: processor.id,
    version: processor.version || "sin-version",
    tableCount: processor.definition && Array.isArray(processor.definition.tables) ? processor.definition.tables.length : 0,
    hasCustomReader: typeof processor.readDocuments === "function"
  }));
}

module.exports = { getProcessor, hasProcessor, assertProcessor, listProcessorIds, listProcessors };
