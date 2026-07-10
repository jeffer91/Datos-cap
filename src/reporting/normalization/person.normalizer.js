/* =========================================================
Nombre completo: person.normalizer.js
Ruta o ubicación: /src/reporting/normalization/person.normalizer.js
Función o funciones:
- Crear claves estables para personas a partir de cédula o nombre.
- Conservar el nombre original junto con su forma comparable.
- Evitar coincidencias silenciosas cuando faltan datos suficientes.
========================================================= */

"use strict";

const {
  displayText,
  normalizeIdentity,
  normalizeKey,
  firstNonEmpty
} = require("./text.normalizer");

const TITLE_PATTERN = /\b(?:ing|ingeniero|ingeniera|lic|licenciado|licenciada|msc|mgtr|magister|magíster|dr|dra|doctor|doctora|phd)\.?\b/gi;

function normalizePersonName(value) {
  return normalizeKey(displayText(value).replace(TITLE_PATTERN, " "));
}

function createPersonKey(identity, name) {
  const identityKey = normalizeIdentity(identity);
  if (identityKey) return `id:${identityKey}`;

  const nameKey = normalizePersonName(name);
  return nameKey ? `name:${nameKey}` : "";
}

function extractPerson(record, source) {
  const config = source || {};
  const identity = firstNonEmpty(record, config.identityFields || []);
  const name = firstNonEmpty(record, config.personFields || []);
  const personKey = createPersonKey(identity, name);

  return {
    personKey,
    identity: displayText(identity),
    identityKey: normalizeIdentity(identity),
    name: displayText(name),
    nameKey: normalizePersonName(name),
    hasReliableIdentity: Boolean(normalizeIdentity(identity)),
    hasUsableName: Boolean(normalizePersonName(name))
  };
}

function choosePreferredPersonName(names) {
  const values = [...new Set((names || []).map(displayText).filter(Boolean))];
  return values.sort((a, b) => {
    const wordDifference = b.split(/\s+/).length - a.split(/\s+/).length;
    if (wordDifference) return wordDifference;
    return b.length - a.length;
  })[0] || "";
}

module.exports = {
  TITLE_PATTERN,
  normalizePersonName,
  createPersonKey,
  extractPerson,
  choosePreferredPersonName
};
