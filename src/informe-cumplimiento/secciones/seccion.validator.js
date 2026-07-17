"use strict";

function validateSection(section) {
  const issues = [];
  if (!section || !section.id) issues.push("La sección no tiene identificador.");
  if (!section || !section.title) issues.push("La sección no tiene título.");
  if (!section || String(section.content || "").trim().length < 20) issues.push("La sección no contiene suficiente texto.");
  return { ok: issues.length === 0, issues };
}

module.exports = { validateSection };
