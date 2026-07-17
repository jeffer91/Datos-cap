"use strict";

function endpointFor(config) {
  const base = String(config.endpoint || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("El proveedor no tiene endpoint configurado.");
  if (/\/chat\/completions$/i.test(base) || /\/messages$/i.test(base)) return base;
  return config.provider === "ANTHROPIC_COMPATIBLE" ? `${base}/v1/messages` : `${base}/v1/chat/completions`;
}

async function requestOnce(config, prompt, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(config.timeoutMs || 45000));
  const url = endpointFor(config);
  const headers = { "content-type": "application/json" };
  let body;
  if (config.provider === "ANTHROPIC_COMPATIBLE") {
    if (config.apiKey) headers["x-api-key"] = config.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = {
      model: config.model,
      max_tokens: Number(options.maxTokens || 1400),
      system: options.system || "Eres un analista institucional. Respeta exactamente las cifras y no inventes datos.",
      messages: [{ role: "user", content: prompt }]
    };
  } else {
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
    body = {
      model: config.model,
      temperature: 0.2,
      max_tokens: Number(options.maxTokens || 1400),
      messages: [
        { role: "system", content: options.system || "Eres un analista institucional. Respeta exactamente las cifras y no inventes datos." },
        { role: "user", content: prompt }
      ]
    };
  }
  try {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `El proveedor respondió HTTP ${response.status}.`);
    const content = config.provider === "ANTHROPIC_COMPATIBLE"
      ? payload?.content?.map((item) => item.text || "").join("\n").trim()
      : payload?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("El proveedor no devolvió texto utilizable.");
    return { ok: true, content, raw: payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function invokeProvider(config, prompt, options = {}) {
  if (!config || config.active === false) throw new Error("El proveedor está desactivado.");
  if (!config.model) throw new Error("El proveedor no tiene modelo configurado.");
  const attempts = [];
  const total = Math.max(1, Number(config.retries || 0) + 1);
  for (let index = 0; index < total; index += 1) {
    const startedAt = Date.now();
    try {
      const result = await requestOnce(config, prompt, options);
      return { ...result, latencyMs: Date.now() - startedAt, attempts: [...attempts, { ok: true, attempt: index + 1 }] };
    } catch (error) {
      attempts.push({ ok: false, attempt: index + 1, message: error.message });
      if (index === total - 1) throw Object.assign(error, { attempts });
    }
  }
  throw new Error("No se pudo ejecutar el proveedor.");
}

module.exports = { endpointFor, invokeProvider };
