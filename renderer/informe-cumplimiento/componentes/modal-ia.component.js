"use strict";

window.ComplianceComponents = window.ComplianceComponents || {};

(function exposeAiModal(namespace, documentObject) {
  const ui = window.AppUI;
  const roles = ["PRIMARY", "SECONDARY", "BACKUP"];
  const labels = { PRIMARY: "IA principal", SECONDARY: "IA secundaria", BACKUP: "IA de respaldo" };

  function providerCard(provider) {
    const role = provider.role;
    return `<article class="ai-provider-card" data-ai-role="${role}">
      <div class="ai-card-title"><div><h3>${labels[role]}</h3><small>${provider.configured ? `Configurada · ${ui.escapeHtml(provider.storageMode || "")}` : "No configurada"}</small></div><label><input type="checkbox" data-field="active" ${provider.active !== false ? "checked" : ""}/> Activa</label></div>
      <div class="ai-form-grid">
        <label>Nombre<input data-field="name" value="${ui.escapeHtml(provider.name || labels[role])}" /></label>
        <label>Proveedor<select data-field="provider">
          <option value="OPENAI_COMPATIBLE" ${provider.provider === "OPENAI_COMPATIBLE" ? "selected" : ""}>OpenAI compatible</option>
          <option value="ANTHROPIC_COMPATIBLE" ${provider.provider === "ANTHROPIC_COMPATIBLE" ? "selected" : ""}>Anthropic compatible</option>
          <option value="LOCAL_OPENAI_COMPATIBLE" ${provider.provider === "LOCAL_OPENAI_COMPATIBLE" ? "selected" : ""}>Servidor local compatible</option>
        </select></label>
        <label class="wide">Endpoint<input data-field="endpoint" value="${ui.escapeHtml(provider.endpoint || "")}" placeholder="https://..." /></label>
        <label>Modelo<input data-field="model" value="${ui.escapeHtml(provider.model || "")}" /></label>
        <label>Credencial<input data-field="apiKey" type="password" placeholder="${provider.keyHint ? `Guardada ····${ui.escapeHtml(provider.keyHint)}` : "Ingresar credencial"}" autocomplete="new-password" /></label>
        <label>Tiempo máximo (ms)<input data-field="timeoutMs" type="number" min="5000" max="180000" value="${ui.escapeHtml(provider.timeoutMs || 45000)}" /></label>
        <label>Reintentos<input data-field="retries" type="number" min="0" max="5" value="${ui.escapeHtml(provider.retries ?? 1)}" /></label>
      </div>
      <div class="ai-card-actions"><button class="btn-secondary btn-small" data-ai-test="${role}">Probar conexión</button><span data-ai-result="${role}"></span></div>
    </article>`;
  }

  namespace.renderAiModal = function renderAiModal(container, providers) {
    const map = new Map((providers || []).map((provider) => [provider.role, provider]));
    container.innerHTML = roles.map((role) => providerCard(map.get(role) || { role, name: labels[role], provider: "OPENAI_COMPATIBLE", active: true, timeoutMs: 45000, retries: 1 })).join("");
  };

  namespace.readAiProvider = function readAiProvider(role) {
    const card = documentObject.querySelector(`[data-ai-role="${role}"]`);
    const value = (field) => card.querySelector(`[data-field="${field}"]`)?.value || "";
    return {
      role,
      name: value("name"), provider: value("provider"), endpoint: value("endpoint"), model: value("model"), apiKey: value("apiKey"),
      timeoutMs: Number(value("timeoutMs") || 45000), retries: Number(value("retries") || 1),
      active: card.querySelector('[data-field="active"]').checked
    };
  };

  namespace.openAiModal = function openAiModal() {
    documentObject.getElementById("aiConfigurationModal").classList.add("open");
    documentObject.getElementById("aiConfigurationModal").setAttribute("aria-hidden", "false");
  };
  namespace.closeAiModal = function closeAiModal() {
    documentObject.getElementById("aiConfigurationModal").classList.remove("open");
    documentObject.getElementById("aiConfigurationModal").setAttribute("aria-hidden", "true");
  };
})(window.ComplianceComponents, document);
