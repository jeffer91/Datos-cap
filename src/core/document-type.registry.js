/* =========================================================
Nombre completo: document-type.registry.js
Ruta o ubicación: /src/core/document-type.registry.js
Función o funciones:
- Registrar los ocho tipos documentales de la aplicación.
- Entregar definiciones seguras al proceso principal y a la interfaz.
- Validar identificadores, prefijos y colecciones antes de iniciar.
========================================================= */

"use strict";

const definitions = [
  require("../document-types/plan-individual/definition"),
  require("../document-types/planificacion-curso/definition"),
  require("../document-types/acuerdo-patrocinio/definition"),
  require("../document-types/informe-final/definition"),
  require("../document-types/instrumento-evaluacion/definition"),
  require("../document-types/informe-impacto/definition"),
  require("../document-types/deteccion-necesidades/definition"),
  require("../document-types/plan-general-capacitacion/definition")
];

function buildRegistry(items) {
  const registry = new Map();
  const prefixes = new Set();
  const collections = new Map();

  items.forEach((definition) => {
    const id = String(definition && definition.id || "").trim();
    if (!id) throw new Error("Existe una definición documental sin identificador.");
    if (registry.has(id)) throw new Error(`Tipo documental duplicado: ${id}.`);

    const reportPrefix = String(definition.reportPrefix || "").trim();
    if (!reportPrefix) throw new Error(`El tipo ${id} no declara reportPrefix.`);
    if (prefixes.has(reportPrefix)) throw new Error(`Prefijo de reporte duplicado: ${reportPrefix}.`);
    prefixes.add(reportPrefix);

    (definition.tables || []).forEach((table) => {
      const tableName = String(table && table.name || "").trim();
      if (!tableName) throw new Error(`El tipo ${id} contiene una tabla sin nombre.`);
      if (collections.has(tableName)) {
        throw new Error(`Colección duplicada entre ${collections.get(tableName)} y ${id}: ${tableName}.`);
      }
      collections.set(tableName, id);
    });

    registry.set(id, definition);
  });

  return registry;
}

const registry = buildRegistry(definitions);

function cloneDefinition(definition) {
  if (!definition) return null;

  return {
    ...definition,
    fileNameHints: [...(definition.fileNameHints || [])],
    tables: (definition.tables || []).map((table) => ({ ...table }))
  };
}

function listDocumentTypes() {
  return definitions.map(cloneDefinition);
}

function getDocumentType(documentTypeId) {
  return cloneDefinition(registry.get(String(documentTypeId || "").trim()));
}

function hasDocumentType(documentTypeId) {
  return registry.has(String(documentTypeId || "").trim());
}

function assertDocumentType(documentTypeId) {
  const definition = getDocumentType(documentTypeId);
  if (!definition) {
    throw new Error(`Tipo documental no reconocido: ${documentTypeId || "vacío"}.`);
  }
  return definition;
}

function getEnabledDocumentTypes() {
  return listDocumentTypes().filter((definition) => definition.enabled);
}

module.exports = {
  buildRegistry,
  listDocumentTypes,
  getDocumentType,
  hasDocumentType,
  assertDocumentType,
  getEnabledDocumentTypes
};
