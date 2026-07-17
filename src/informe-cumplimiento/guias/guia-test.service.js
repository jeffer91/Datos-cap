"use strict";

class GuideTestService {
  constructor(sectionGenerator, aiOrchestrator) {
    this.sectionGenerator = sectionGenerator;
    this.ai = aiOrchestrator;
  }

  async test(report, guide, options = {}) {
    const internal = this.sectionGenerator.generate(report, guide, { persist: false });
    if (String(options.mode || "INTERNAL").toUpperCase() !== "AI") {
      return { ok: true, mode: "INTERNAL", section: internal, ai: null };
    }
    const ai = await this.ai.refineSection({ report, guide, section: internal });
    return {
      ok: true,
      mode: ai.status === "AI_REFINED" ? "AI" : "INTERNAL_FALLBACK",
      section: ai.status === "AI_REFINED" ? { ...internal, content: ai.content, ai } : internal,
      ai
    };
  }
}

module.exports = { GuideTestService };
