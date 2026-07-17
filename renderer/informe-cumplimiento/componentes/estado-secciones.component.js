"use strict";

window.ComplianceComponents = window.ComplianceComponents || {};

(function exposeSectionCards(namespace) {
  const ui = window.AppUI;
  function chip(label, value) {
    const normalized = String(value || "PENDIENTE").toUpperCase();
    const css = normalized.includes("CORRECT") || normalized.includes("GENERADO") || normalized === "DISPONIBLE" || normalized.includes("REFINADO")
      ? "section-chip-success"
      : normalized.includes("REVIS") || normalized.includes("ADVERT") || normalized.includes("RESPALDO")
        ? "section-chip-warning" : "section-chip-muted";
    return `<span class="section-status-chip ${css}"><small>${ui.escapeHtml(label)}</small>${ui.escapeHtml(normalized.replaceAll("_", " "))}</span>`;
  }

  namespace.renderSectionCards = function renderSectionCards(container, sections, handlers) {
    container.innerHTML = (sections || []).map((section) => `
      <article class="section-card" data-section-id="${ui.escapeHtml(section.id)}">
        <div class="section-card-header">
          <div><h3>${ui.escapeHtml(section.title)}</h3><small>${section.generatedAt ? `Última generación: ${ui.escapeHtml(new Date(section.generatedAt).toLocaleString("es-EC"))}` : "Sin generación guardada"}</small></div>
          <label class="section-selector"><input type="checkbox" data-export-section="${ui.escapeHtml(section.id)}" checked /> Incluir</label>
        </div>
        <div class="section-status-row">
          ${chip("Datos", section.status?.data)}
          ${chip("Motor", section.status?.internal)}
          ${chip("IA", section.status?.ai)}
          ${chip("Validación", section.status?.validation)}
        </div>
        ${section.warnings?.length ? `<div class="section-warning">${ui.escapeHtml(section.warnings.join(" "))}</div>` : ""}
        <div class="section-actions">
          <button class="btn-secondary btn-small" data-action="edit">Editar guía</button>
          <button class="btn-secondary btn-small" data-action="test">Probar</button>
          <button class="btn-secondary btn-small" data-action="generate">Regenerar</button>
          <button class="btn-secondary btn-small" data-action="docx">Descargar Word</button>
          <button class="btn-secondary btn-small" data-action="pdf">Descargar PDF</button>
        </div>
      </article>`).join("");
    container.querySelectorAll("[data-section-id]").forEach((card) => {
      const id = card.dataset.sectionId;
      card.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handlers[button.dataset.action]?.(id)));
    });
  };
})(window.ComplianceComponents);
