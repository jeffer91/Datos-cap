"use strict";

const { invokeProvider } = require("./ia-provider.factory");
const { validateAiText } = require("./ia-response.validator");

const ORDER = ["PRIMARY", "SECONDARY", "BACKUP"];

class AiOrchestrator {
  constructor(options = {}) {
    this.configRepository = options.configRepository || null;
    this.staticProviders = new Map();
    [["PRIMARY", options.primary], ["SECONDARY", options.secondary], ["BACKUP", options.backup]].forEach(([role, provider]) => {
      if (provider && typeof provider.invoke === "function") this.staticProviders.set(role, provider.invoke);
    });
  }

  getStatus() {
    if (this.configRepository) return this.configRepository.listPublic();
    return ORDER.map((role, index) => ({ role, name: role, priority: index + 1, configured: this.staticProviders.has(role), active: true }));
  }

  runtime(role) {
    if (this.configRepository) return this.configRepository.getRuntime(role);
    const invoke = this.staticProviders.get(role);
    return invoke ? { role, active: true, invoke } : null;
  }

  promptFor({ report, guide, section }) {
    return [
      `SECCIÓN: ${guide.title}`,
      `TONO: ${guide.tone}`,
      `EXTENSIÓN MÁXIMA: ${guide.maxWords} palabras`,
      `INSTRUCCIONES: ${guide.instructions}`,
      "REGLAS: No modificar cifras. No inventar información. Indicar cuando falten datos. Entregar solo el texto final de la sección.",
      `BORRADOR INTERNO:\n${section.content}`,
      `EVIDENCIA ESTRUCTURADA:\n${JSON.stringify({ metrics: report.metrics, objectives: report.objectives, gaps: report.gaps, evidence: section.evidence }, null, 2)}`
    ].join("\n\n");
  }

  async invokeRole(role, prompt) {
    const runtime = this.runtime(role);
    if (!runtime || runtime.active === false) throw new Error("Proveedor no configurado o desactivado.");
    if (typeof runtime.invoke === "function") return runtime.invoke({ prompt });
    return invokeProvider(runtime, prompt);
  }

  async refineSection({ report, guide, section }) {
    if (guide.providerPreference === "INTERNAL") {
      return { status: "INTERNAL_FALLBACK", content: section.content, provider: "INTERNAL_ENGINE", attempts: [], message: "La guía está configurada para usar únicamente el motor interno." };
    }
    const preferred = guide.providerPreference && guide.providerPreference !== "AUTO" ? [guide.providerPreference] : ORDER;
    const roles = [...preferred, ...ORDER.filter((role) => !preferred.includes(role))];
    const prompt = this.promptFor({ report, guide, section });
    const attempts = [];
    for (const role of roles) {
      try {
        const response = await this.invokeRole(role, prompt);
        const content = String(response?.content || response?.response?.content || "").trim();
        const validation = validateAiText(content, { metrics: report.metrics, objectives: report.objectives, gaps: report.gaps, evidence: section.evidence });
        if (!validation.ok) {
          attempts.push({ role, ok: false, code: "INVALID_CONTENT", issues: validation.issues });
          continue;
        }
        return {
          status: "AI_REFINED",
          provider: role,
          content,
          validation,
          latencyMs: response.latencyMs,
          attempts: [...attempts, { role, ok: true }]
        };
      } catch (error) {
        attempts.push({ role, ok: false, code: "ERROR", message: error.message });
      }
    }
    return {
      status: "INTERNAL_FALLBACK",
      provider: "INTERNAL_ENGINE",
      content: section.content,
      attempts,
      message: "Las tres IAs no están disponibles o no superaron la validación. Se conserva el análisis interno verificable."
    };
  }

  async refine(report) {
    const guide = { id: "general", title: "Análisis global", tone: "Institucional", maxWords: 900, instructions: "Refinar el análisis global sin cambiar cifras.", providerPreference: "AUTO" };
    const section = { content: (report.analysis?.findings || []).map((item) => item.text).join("\n"), evidence: [] };
    return this.refineSection({ report, guide, section });
  }

  async testChain() {
    const attempts = [];
    for (const role of ORDER) {
      try {
        const response = await this.invokeRole(role, "Responde solamente: CADENA_OK");
        const content = String(response?.content || response?.response?.content || "");
        attempts.push({ role, ok: /CADENA_OK/i.test(content), response: content, latencyMs: response?.latencyMs });
      } catch (error) {
        attempts.push({ role, ok: false, message: error.message });
      }
    }
    return { ok: attempts.some((item) => item.ok), attempts, fallbackAvailable: true };
  }
}

module.exports = { ORDER, AiOrchestrator };
