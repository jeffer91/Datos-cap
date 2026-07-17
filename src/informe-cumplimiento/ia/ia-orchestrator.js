"use strict";

class AiOrchestrator {
  constructor(options = {}) {
    this.providers = [options.primary, options.secondary, options.backup].map((provider, index) => ({ name: ["PRIMARY", "SECONDARY", "BACKUP"][index], invoke: provider?.invoke }));
  }
  getStatus() { return this.providers.map((provider, index) => ({ order: index + 1, name: provider.name, configured: typeof provider.invoke === "function" })); }
  async refine(report) {
    const payload = {
      instruction: "Mejorar la redacción sin modificar cifras ni inventar datos.",
      metrics: report.metrics, objectives: report.objectives, gaps: report.gaps, internalAnalysis: report.analysis
    };
    const attempts = [];
    for (const provider of this.providers) {
      if (typeof provider.invoke !== "function") { attempts.push({ provider: provider.name, ok: false, code: "NOT_CONFIGURED" }); continue; }
      try {
        const response = await provider.invoke(payload);
        if (response?.ok) return { status: "AI_REFINED", provider: provider.name, response, attempts: [...attempts, { provider: provider.name, ok: true }] };
        attempts.push({ provider: provider.name, ok: false, code: response?.code || "INVALID_RESPONSE" });
      } catch (error) { attempts.push({ provider: provider.name, ok: false, code: "ERROR", message: error.message }); }
    }
    return { status: "INTERNAL_FALLBACK", response: null, attempts, message: "Las IAs no están disponibles. Se conserva el análisis interno verificable." };
  }
}

module.exports = { AiOrchestrator };
