"use strict";

function numericTokens(value) {
  return new Set((String(value == null ? "" : value).match(/-?\d+(?:[.,]\d+)?/g) || []).map((token) => token.replace(",", ".").replace(/^0+(?=\d)/, "")));
}

function validateAiText(content, source) {
  const text = String(content || "").trim();
  const issues = [];
  if (text.length < 40) issues.push("La respuesta de IA es demasiado corta.");
  if (/\b(undefined|null|nan)\b/i.test(text)) issues.push("La respuesta contiene valores técnicos inválidos.");
  const allowed = numericTokens(JSON.stringify(source || {}));
  const output = numericTokens(text);
  const invented = [...output].filter((token) => !allowed.has(token) && !new Set(["1", "2", "3", "4", "5"]).has(token));
  if (invented.length) issues.push(`La IA introdujo cifras no presentes en la evidencia: ${invented.slice(0, 8).join(", ")}.`);
  return { ok: issues.length === 0, issues, inventedNumbers: invented };
}

module.exports = { numericTokens, validateAiText };
