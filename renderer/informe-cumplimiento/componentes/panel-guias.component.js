"use strict";

window.ComplianceComponents = window.ComplianceComponents || {};

(function exposeGuidePanel(namespace, documentObject) {
  const ui = window.AppUI;

  namespace.renderGuideList = function renderGuideList(container, guides, selectedId, onSelect) {
    container.innerHTML = (guides || []).map((guide) => `
      <button class="guide-list-item ${guide.id === selectedId ? "active" : ""}" data-guide-id="${ui.escapeHtml(guide.id)}">
        <span>${ui.escapeHtml(guide.title)}</span>
        <small>${guide.isDefault ? "Predeterminada" : "Personalizada"}</small>
      </button>`).join("");
    container.querySelectorAll("[data-guide-id]").forEach((button) => button.addEventListener("click", () => onSelect(button.dataset.guideId)));
  };

  namespace.fillGuideForm = function fillGuideForm(guide) {
    documentObject.getElementById("guideTitle").value = guide?.title || "";
    documentObject.getElementById("guideInstructions").value = guide?.instructions || "";
    documentObject.getElementById("guideDataScope").value = (guide?.dataScope || []).join(", ");
    documentObject.getElementById("guideTone").value = guide?.tone || "";
    documentObject.getElementById("guideMaxWords").value = guide?.maxWords || 500;
    documentObject.getElementById("guideProviderPreference").value = guide?.providerPreference || "AUTO";
    documentObject.getElementById("guideEnabled").checked = guide?.enabled !== false;
  };

  namespace.readGuideForm = function readGuideForm(selectedGuide) {
    return {
      ...selectedGuide,
      title: documentObject.getElementById("guideTitle").value,
      instructions: documentObject.getElementById("guideInstructions").value,
      dataScope: documentObject.getElementById("guideDataScope").value.split(",").map((value) => value.trim()).filter(Boolean),
      tone: documentObject.getElementById("guideTone").value,
      maxWords: Number(documentObject.getElementById("guideMaxWords").value || 500),
      providerPreference: documentObject.getElementById("guideProviderPreference").value,
      enabled: documentObject.getElementById("guideEnabled").checked
    };
  };

  namespace.renderGuideTest = function renderGuideTest(container, result) {
    if (!result) { container.innerHTML = '<div class="empty compact">Aquí aparecerá el resultado temporal de la prueba.</div>'; return; }
    const section = result.section || {};
    container.innerHTML = `
      <div class="guide-test-header"><strong>${ui.escapeHtml(section.title || "Prueba")}</strong><span>${ui.escapeHtml(result.mode || "INTERNAL")}</span></div>
      <p>${ui.escapeHtml(section.content || result.message || "Sin resultado.")}</p>
      ${result.ai?.attempts?.length ? `<details><summary>Intentos de IA</summary><pre>${ui.escapeHtml(JSON.stringify(result.ai.attempts, null, 2))}</pre></details>` : ""}`;
  };
})(window.ComplianceComponents, document);
