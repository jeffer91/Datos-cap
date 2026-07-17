"use strict";

const AI_CONFIG_COLLECTION = "informe_cumplimiento_ia_config";
const ROLES = Object.freeze(["PRIMARY", "SECONDARY", "BACKUP"]);

function clean(value) { return String(value == null ? "" : value).trim(); }
function nowIso() { return new Date().toISOString(); }

function defaults() {
  return ROLES.map((role, index) => ({
    id: role,
    role,
    name: role === "PRIMARY" ? "IA principal" : role === "SECONDARY" ? "IA secundaria" : "IA de respaldo",
    provider: "OPENAI_COMPATIBLE",
    endpoint: "",
    model: "",
    active: true,
    timeoutMs: 45000,
    retries: 1,
    priority: index + 1,
    apiKeyEncrypted: "",
    keyHint: "",
    storageMode: "NOT_CONFIGURED",
    updatedAt: ""
  }));
}

class AiConfigRepository {
  constructor(database, secretStore = {}) {
    if (!database) throw new Error("AiConfigRepository requiere la base local.");
    this.database = database;
    this.secretStore = secretStore;
    this.memorySecrets = new Map();
  }
  read() {
    try { return this.database.readCollection(AI_CONFIG_COLLECTION); }
    catch (_error) { return []; }
  }
  listPublic() {
    const saved = new Map(this.read().map((item) => [item.role, item]));
    return defaults().map((item) => {
      const merged = { ...item, ...(saved.get(item.role) || {}) };
      return {
        role: merged.role,
        name: merged.name,
        provider: merged.provider,
        endpoint: merged.endpoint,
        model: merged.model,
        active: merged.active !== false,
        timeoutMs: merged.timeoutMs,
        retries: merged.retries,
        priority: merged.priority,
        configured: Boolean(merged.model && merged.endpoint && (merged.apiKeyEncrypted || this.memorySecrets.has(merged.role) || merged.provider === "LOCAL_OPENAI_COMPATIBLE")),
        keyHint: merged.keyHint,
        storageMode: merged.storageMode,
        updatedAt: merged.updatedAt
      };
    }).sort((a, b) => a.priority - b.priority);
  }
  save(input) {
    const role = clean(input?.role).toUpperCase();
    if (!ROLES.includes(role)) throw new Error("Rol de IA no permitido.");
    const current = this.read().find((item) => item.role === role) || defaults().find((item) => item.role === role);
    const provider = clean(input.provider || current.provider).toUpperCase();
    if (!new Set(["OPENAI_COMPATIBLE", "ANTHROPIC_COMPATIBLE", "LOCAL_OPENAI_COMPATIBLE"]).has(provider)) {
      throw new Error("Proveedor de IA no permitido.");
    }
    const endpoint = clean(input.endpoint);
    const model = clean(input.model);
    const timeoutMs = Math.min(180000, Math.max(5000, Number(input.timeoutMs || current.timeoutMs || 45000)));
    const retries = Math.min(5, Math.max(0, Number(input.retries ?? current.retries ?? 1)));
    let apiKeyEncrypted = current.apiKeyEncrypted || "";
    let keyHint = current.keyHint || "";
    let storageMode = current.storageMode || "NOT_CONFIGURED";
    const apiKey = clean(input.apiKey);
    if (input.clearApiKey === true) {
      apiKeyEncrypted = "";
      keyHint = "";
      storageMode = "NOT_CONFIGURED";
      this.memorySecrets.delete(role);
    } else if (apiKey) {
      keyHint = apiKey.slice(-4);
      const encrypted = typeof this.secretStore.encrypt === "function" ? this.secretStore.encrypt(apiKey) : "";
      if (encrypted) {
        apiKeyEncrypted = encrypted;
        storageMode = "ENCRYPTED";
        this.memorySecrets.delete(role);
      } else {
        apiKeyEncrypted = "";
        storageMode = "MEMORY_ONLY";
        this.memorySecrets.set(role, apiKey);
      }
    }
    const row = {
      ...current,
      id: role,
      role,
      name: clean(input.name) || current.name,
      provider,
      endpoint,
      model,
      active: input.active !== false,
      timeoutMs,
      retries,
      apiKeyEncrypted,
      keyHint,
      storageMode,
      updatedAt: nowIso()
    };
    this.database.upsertMany(AI_CONFIG_COLLECTION, [row], "id");
    return this.listPublic().find((item) => item.role === role);
  }
  getRuntime(role) {
    const cleanRole = clean(role).toUpperCase();
    const row = this.read().find((item) => item.role === cleanRole) || defaults().find((item) => item.role === cleanRole);
    if (!row) return null;
    let apiKey = this.memorySecrets.get(cleanRole) || "";
    if (!apiKey && row.apiKeyEncrypted && typeof this.secretStore.decrypt === "function") {
      try { apiKey = this.secretStore.decrypt(row.apiKeyEncrypted) || ""; }
      catch (_error) { apiKey = ""; }
    }
    return { ...row, apiKey };
  }
}

module.exports = { AI_CONFIG_COLLECTION, ROLES, AiConfigRepository };
