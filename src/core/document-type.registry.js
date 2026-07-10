/* =========================================================
Nombre completo: document-type.registry.js
Ruta o ubicación: /src/core/document-type.registry.js
Función o funciones:
- Registrar los ocho tipos documentales de la aplicación.
- Entregar definiciones seguras al proceso principal y a la interfaz.
- Validar identificadores de apartados antes de procesar archivos.
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

const registry = new Map(definitions.map((definition) => [definition.id, definition]));

function cloneDefinition(definition) {
  if (!definition) {
    return null;
  }

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
  listDocumentTypes,
  getDocumentType,
  hasDocumentType,
  assertDocumentType,
  getEnabledDocumentTypes
};
