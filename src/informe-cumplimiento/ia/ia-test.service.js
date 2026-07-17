"use strict";

const { invokeProvider } = require("./ia-provider.factory");

class AiTestService {
  constructor(configRepository) { this.configRepository = configRepository; }
  async testProvider(role) {
    const config = this.configRepository.getRuntime(role);
    if (!config) throw new Error("No existe configuración para ese rol.");
    const result = await invokeProvider(config, "Responde solamente: CONEXION_OK", { maxTokens: 20 });
    return {
      ok: /CONEXION_OK/i.test(result.content),
      role: config.role,
      provider: config.provider,
      model: config.model,
      latencyMs: result.latencyMs,
      response: result.content
    };
  }
}

module.exports = { AiTestService };
