"use strict";

const ALLOWED_PROVIDER_PREFERENCES = new Set(["AUTO", "PRIMARY", "SECONDARY", "BACKUP", "INTERNAL"]);

function clean(value) { return String(value == null ? "" : value).trim(); }

function validateGuide(input) {
  const guide = input || {};
  const issues = [];
  if (!/^[a-z0-9-]+$/i.test(clean(guide.id))) issues.push("La guía requiere un identificador válido.");
  if (clean(guide.title).length < 3) issues.push("La guía requiere un título.");
  if (clean(guide.instructions).length < 20) issues.push("Las instrucciones deben tener al menos 20 caracteres.");
  const maxWords = Number(guide.maxWords || 0);
  if (!Number.isFinite(maxWords) || maxWords < 50 || maxWords > 5000) issues.push("La extensión máxima debe estar entre 50 y 5000 palabras.");
  const providerPreference = clean(guide.providerPreference || "AUTO").toUpperCase();
  if (!ALLOWED_PROVIDER_PREFERENCES.has(providerPreference)) issues.push("La preferencia de IA no es válida.");
  return {
    ok: issues.length === 0,
    issues,
    value: {
      id: clean(guide.id),
      title: clean(guide.title),
      instructions: clean(guide.instructions),
      dataScope: Array.isArray(guide.dataScope) ? guide.dataScope.map(clean).filter(Boolean) : [],
      tone: clean(guide.tone) || "Institucional",
      maxWords,
      providerPreference,
      enabled: guide.enabled !== false,
      order: Number.isFinite(Number(guide.order)) ? Number(guide.order) : 999
    }
  };
}

module.exports = { ALLOWED_PROVIDER_PREFERENCES, validateGuide };
