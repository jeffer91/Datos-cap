/* =========================================================
Nombre completo: processor.registry.js
Ruta o ubicación: /src/core/processor.registry.js
Función o funciones:
- Registrar los procesadores especializados disponibles.
- Resolver un procesador por identificador de tipo documental.
- Validar duplicados y contratos antes de iniciar la aplicación.
- Informar versiones y cantidad de tablas de cada procesador.
========================================================= */

"use strict";

const processors = [
  require("../document-types/plan-individual"),
  require("../document-types/planificacion-curso"),
  require("../document-types/acuerdo-patrocinio"),
  require("../document-types/informe-final"),
  require("../document-types/instrumento-evaluacion"),
  require("../document-types/informe-impacto"),
  require("../document-types/deteccion-necesidades"),
  require("../document-types/plan-general-capacitacion")
];

const REQUIRED_METHODS = Object.freeze([
  "parseDocuments",
  "buildTables",
  "validateParseResult",
  "validateTableResult"
]);

function validateProcessor(processor) {
  const id = String(processor && processor.id || "").trim();
  if (!id) throw new Error("Existe un procesador documental sin identificador.");
  if (!processor.definition || processor.definition.id !== id) {
    throw new Error(`El procesador ${id} no expone una definición coherente.`);
  }
  REQUIRED_METHODS.forEach((method) => {
    if (typeof processor[method] !== "function") {
      throw new Error(`El procesador ${id} no implementa ${method}().`);
    }
  });
  return id;
}

function buildRegistry(items) {
  const registry = new Map();
  items.forEach((processor) => {
    const id = validateProcessor(processor);
    if (registry.has(id)) throw new Error(`Procesador documental duplicado: ${id}.`);
    registry.set(id, processor);
  });
  return registry;
}

const registry = buildRegistry(processors);

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

function listProcessors() {
  return Array.from(registry.values()).map((processor) => ({
    id: processor.id,
    version: processor.version || "sin-version",
    tableCount: processor.definition && Array.isArray(processor.definition.tables)
      ? processor.definition.tables.length
      : 0,
    hasCustomReader: typeof processor.readDocuments === "function"
  }));
}

module.exports = {
  REQUIRED_METHODS,
  validateProcessor,
  buildRegistry,
  getProcessor,
  hasProcessor,
  assertProcessor,
  listProcessorIds,
  listProcessors
};
