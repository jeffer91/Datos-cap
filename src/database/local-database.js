/* =========================================================
Nombre completo: local-database.js
Ruta o ubicación: /src/database/local-database.js
Función o funciones:
- Implementar una base local rápida mediante colecciones JSON.
- Aplicar escrituras atómicas con respaldo temporal.
- Consultar, reemplazar y actualizar colecciones por identificador.
========================================================= */
"use strict";

const fs = require("fs");
const path = require("path");

const DATABASE_VERSION = 1;
const COLLECTION_PATTERN = /^[a-z0-9_]+$/i;

function nowIso() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ensureDirectory(dir) {
  const clean = String(dir || "").trim();
  if (!clean) throw new Error("La base local requiere una carpeta válida.");
  if (!fs.existsSync(clean)) fs.mkdirSync(clean, { recursive: true });
  if (!fs.statSync(clean).isDirectory()) throw new Error(`La ruta no es una carpeta: ${clean}`);
  return clean;
}
function safeCollection(name) {
  const clean = String(name || "").trim();
  if (!COLLECTION_PATTERN.test(clean)) throw new Error(`Nombre de colección no permitido: ${name || "vacío"}.`);
  return clean;
}

class LocalDatabase {
  constructor(rootDirectory) {
    this.rootDirectory = path.resolve(String(rootDirectory || "").trim());
    this.collectionsDirectory = path.join(this.rootDirectory, "collections");
    this.metadataPath = path.join(this.rootDirectory, "database.meta.json");
    this.initialized = false;
  }

  initialize() {
    ensureDirectory(this.rootDirectory);
    ensureDirectory(this.collectionsDirectory);
    this.recoverInterruptedWrites();
    if (!fs.existsSync(this.metadataPath)) {
      this.writeJsonAtomic(this.metadataPath, {
        databaseVersion: DATABASE_VERSION,
        engine: "json-collections",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        description: "Base local de documentos de capacitación"
      });
    }
    this.initialized = true;
    return this.getSummary();
  }

  assertInitialized() { if (!this.initialized) this.initialize(); }
  collectionPath(name) { return path.join(this.collectionsDirectory, `${safeCollection(name)}.json`); }

  recoverInterruptedWrites() {
    if (!fs.existsSync(this.collectionsDirectory)) return;
    fs.readdirSync(this.collectionsDirectory).forEach((fileName) => {
      const filePath = path.join(this.collectionsDirectory, fileName);
      if (fileName.endsWith(".tmp")) {
        try { fs.unlinkSync(filePath); } catch (_error) { /* reintento al próximo inicio */ }
      }
      if (fileName.endsWith(".bak")) {
        const original = filePath.slice(0, -4);
        try {
          if (!fs.existsSync(original)) fs.renameSync(filePath, original);
          else fs.unlinkSync(filePath);
        } catch (_error) { /* conserva respaldo */ }
      }
    });
  }

  readJson(filePath, fallback) {
    if (!fs.existsSync(filePath)) return clone(fallback);
    const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(content);
  }

  writeJsonAtomic(filePath, value) {
    ensureDirectory(path.dirname(filePath));
    const temp = `${filePath}.tmp`;
    const backup = `${filePath}.bak`;
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    try {
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      if (fs.existsSync(filePath)) fs.renameSync(filePath, backup);
      fs.renameSync(temp, filePath);
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
    } catch (error) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(backup)) fs.renameSync(backup, filePath);
      } catch (_restoreError) { /* conserva respaldo */ }
      try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (_cleanupError) { /* sin acción */ }
      throw error;
    }
  }

  readCollectionPayload(name) {
    this.assertInitialized();
    const collection = safeCollection(name);
    const payload = this.readJson(this.collectionPath(collection), {
      collection,
      databaseVersion: DATABASE_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      records: []
    });
    if (!payload || payload.collection !== collection || !Array.isArray(payload.records)) {
      throw new Error(`La colección ${collection} tiene una estructura inválida.`);
    }
    return payload;
  }

  readCollection(name) { return clone(this.readCollectionPayload(name).records); }

  writeCollection(name, records) {
    const collection = safeCollection(name);
    const current = this.readCollectionPayload(collection);
    const payload = {
      collection,
      databaseVersion: DATABASE_VERSION,
      createdAt: current.createdAt || nowIso(),
      updatedAt: nowIso(),
      records: clone(Array.isArray(records) ? records : [])
    };
    this.writeJsonAtomic(this.collectionPath(collection), payload);
    this.touchMetadata();
    return payload;
  }

  upsertMany(name, records, keyField = "id") {
    const current = this.readCollection(name);
    const index = new Map();
    current.forEach((row, position) => {
      const key = String(row && row[keyField] != null ? row[keyField] : "").trim();
      if (key) index.set(key, position);
    });
    let inserted = 0;
    let updated = 0;
    let rejected = 0;
    const timestamp = nowIso();
    (Array.isArray(records) ? records : []).forEach((record) => {
      if (!record || typeof record !== "object") { rejected += 1; return; }
      const source = clone(record);
      const key = String(source[keyField] != null ? source[keyField] : "").trim();
      if (!key) { rejected += 1; return; }
      if (!index.has(key)) {
        current.push({ ...source, _createdAt: timestamp, _updatedAt: timestamp });
        index.set(key, current.length - 1);
        inserted += 1;
      } else {
        const position = index.get(key);
        current[position] = {
          ...current[position],
          ...source,
          _createdAt: current[position]._createdAt || timestamp,
          _updatedAt: timestamp
        };
        updated += 1;
      }
    });
    this.writeCollection(name, current);
    return { inserted, updated, rejected, totalAfter: current.length };
  }

  replaceCollection(name, records) {
    this.writeCollection(name, Array.isArray(records) ? records : []);
    return { replaced: true, totalAfter: Array.isArray(records) ? records.length : 0 };
  }

  listCollections() {
    this.assertInitialized();
    return fs.readdirSync(this.collectionsDirectory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.slice(0, -5))
      .sort();
  }

  touchMetadata() {
    const metadata = this.readJson(this.metadataPath, {});
    this.writeJsonAtomic(this.metadataPath, { ...metadata, updatedAt: nowIso() });
  }

  getSummary() {
    this.assertInitialized();
    const collections = this.listCollections();
    const counts = {};
    collections.forEach((name) => { counts[name] = this.readCollection(name).length; });
    const documents = counts._documents ? this.readCollection("_documents") : [];
    const runs = counts._processing_runs ? this.readCollection("_processing_runs") : [];
    const tableCollections = collections.filter((name) => !name.startsWith("_"));
    return {
      ok: true,
      databasePath: this.rootDirectory,
      collectionCount: collections.length,
      documentCount: documents.length,
      planCount: documents.filter((row) => row.tipo_documental === "plan-individual").length,
      agreementCount: documents.filter((row) => row.tipo_documental === "acuerdo-patrocinio").length,
      tableRows: tableCollections.reduce((sum, name) => sum + Number(counts[name] || 0), 0),
      processingRunCount: runs.length,
      duplicateCount: runs.reduce((sum, row) => sum + Number(row.documentos_duplicados_omitidos || 0), 0),
      lastUpdatedAt: this.readJson(this.metadataPath, {}).updatedAt || "",
      counts
    };
  }
}

module.exports = { DATABASE_VERSION, LocalDatabase, nowIso };
