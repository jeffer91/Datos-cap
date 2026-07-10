/* =========================================================
Nombre completo: local-database.js
Ruta o ubicación: /src/database/local-database.js
Función o funciones:
- Implementar una base local no relacional sin dependencias nativas.
- Guardar cada tabla documental como una colección JSON independiente.
- Aplicar escrituras atómicas, restauración básica y transacciones con reversión.
- Permitir consultas, reemplazos, inserciones, actualizaciones y estadísticas.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

const DATABASE_VERSION = 1;
const COLLECTION_NAME_PATTERN = /^[a-z0-9_]+$/i;

function nowIso() {
  return new Date().toISOString();
}

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) fs.mkdirSync(directoryPath, { recursive: true });
  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) throw new Error(`La ruta no es un directorio válido: ${directoryPath}`);
  return directoryPath;
}

function sanitizeCollectionName(collectionName) {
  const name = String(collectionName || "").trim();
  if (!COLLECTION_NAME_PATTERN.test(name)) {
    throw new Error(`Nombre de colección no permitido: ${collectionName || "vacío"}.`);
  }
  return name;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function comparableRecord(record) {
  const copy = { ...(record || {}) };
  delete copy._createdAt;
  delete copy._updatedAt;
  return JSON.stringify(copy);
}

class LocalDatabase {
  constructor(rootDirectory) {
    const root = String(rootDirectory || "").trim();
    if (!root) throw new Error("La base local requiere una carpeta raíz.");

    this.rootDirectory = path.resolve(root);
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
        createdAt: nowIso(),
        updatedAt: nowIso(),
        engine: "json-collections",
        description: "Base local no relacional del Gestor Documental de Capacitación"
      });
    } else {
      const metadata = this.readJson(this.metadataPath, null);
      if (!metadata || Number(metadata.databaseVersion) !== DATABASE_VERSION) {
        throw new Error("La versión de la base local no es compatible con esta aplicación.");
      }
    }

    this.initialized = true;
    return this.getDatabaseInfo();
  }

  assertInitialized() {
    if (!this.initialized) this.initialize();
  }

  getDatabaseInfo() {
    return {
      databaseVersion: DATABASE_VERSION,
      rootDirectory: this.rootDirectory,
      collectionsDirectory: this.collectionsDirectory,
      metadataPath: this.metadataPath
    };
  }

  collectionPath(collectionName) {
    return path.join(this.collectionsDirectory, `${sanitizeCollectionName(collectionName)}.json`);
  }

  recoverInterruptedWrites() {
    if (!fs.existsSync(this.collectionsDirectory)) return;

    fs.readdirSync(this.collectionsDirectory).forEach((fileName) => {
      const filePath = path.join(this.collectionsDirectory, fileName);

      if (fileName.endsWith(".tmp")) {
        try { fs.unlinkSync(filePath); } catch (_error) { /* Se limpiará en el próximo inicio. */ }
        return;
      }

      if (fileName.endsWith(".bak")) {
        const originalPath = filePath.slice(0, -4);
        try {
          if (!fs.existsSync(originalPath)) fs.renameSync(filePath, originalPath);
          else fs.unlinkSync(filePath);
        } catch (_error) {
          // No se elimina el respaldo cuando no puede restaurarse con seguridad.
        }
      }
    });
  }

  readJson(filePath, fallbackValue) {
    if (!fs.existsSync(filePath)) return cloneJson(fallbackValue);

    try {
      const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
      return JSON.parse(content);
    } catch (error) {
      const corruptPath = `${filePath}.corrupt-${Date.now()}`;
      try { fs.copyFileSync(filePath, corruptPath); } catch (_copyError) { /* Conserva el original. */ }
      throw new Error(`No se pudo leer la base local ${path.basename(filePath)}: ${error.message}`);
    }
  }

  writeJsonAtomic(filePath, value) {
    ensureDirectory(path.dirname(filePath));
    const temporaryPath = `${filePath}.tmp`;
    const backupPath = `${filePath}.bak`;
    const json = `${JSON.stringify(value, null, 2)}\n`;

    fs.writeFileSync(temporaryPath, json, "utf8");

    try {
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      if (fs.existsSync(filePath)) fs.renameSync(filePath, backupPath);
      fs.renameSync(temporaryPath, filePath);
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    } catch (error) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(backupPath)) fs.renameSync(backupPath, filePath);
      } catch (_restoreError) {
        // El respaldo permanece disponible para recuperación manual o automática.
      }
      try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (_cleanupError) { /* Sin acción. */ }
      throw error;
    }
  }

  readCollectionPayload(collectionName) {
    this.assertInitialized();
    const name = sanitizeCollectionName(collectionName);
    const payload = this.readJson(this.collectionPath(name), {
      collection: name,
      databaseVersion: DATABASE_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      records: []
    });

    if (!payload || payload.collection !== name || !Array.isArray(payload.records)) {
      throw new Error(`La colección ${name} tiene una estructura inválida.`);
    }

    return payload;
  }

  readCollection(collectionName) {
    return cloneJson(this.readCollectionPayload(collectionName).records);
  }

  writeCollection(collectionName, records, existingPayload = null) {
    this.assertInitialized();
    const name = sanitizeCollectionName(collectionName);
    const current = existingPayload || this.readCollectionPayload(name);
    const payload = {
      collection: name,
      databaseVersion: DATABASE_VERSION,
      createdAt: current.createdAt || nowIso(),
      updatedAt: nowIso(),
      records: cloneJson(Array.isArray(records) ? records : [])
    };
    this.writeJsonAtomic(this.collectionPath(name), payload);
    return payload;
  }

  buildUpsertResult(existingRecords, incomingRecords, keyField = "id") {
    const current = Array.isArray(existingRecords) ? cloneJson(existingRecords) : [];
    const incoming = Array.isArray(incomingRecords) ? incomingRecords : [];
    const indexByKey = new Map();
    const timestamp = nowIso();
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let rejected = 0;

    current.forEach((record, index) => {
      const key = String(record && record[keyField] !== undefined ? record[keyField] : "").trim();
      if (key) indexByKey.set(key, index);
    });

    incoming.forEach((record) => {
      const source = record && typeof record === "object" ? cloneJson(record) : null;
      const key = String(source && source[keyField] !== undefined ? source[keyField] : "").trim();

      if (!source || !key) {
        rejected += 1;
        return;
      }

      if (!indexByKey.has(key)) {
        current.push({ ...source, _createdAt: timestamp, _updatedAt: timestamp });
        indexByKey.set(key, current.length - 1);
        inserted += 1;
        return;
      }

      const index = indexByKey.get(key);
      const previous = current[index];
      const next = {
        ...previous,
        ...source,
        _createdAt: previous._createdAt || timestamp,
        _updatedAt: timestamp
      };

      if (comparableRecord(previous) === comparableRecord(next)) {
        unchanged += 1;
        return;
      }

      current[index] = next;
      updated += 1;
    });

    return {
      records: current,
      result: {
        inserted,
        updated,
        unchanged,
        rejected,
        received: incoming.length,
        totalAfter: current.length
      }
    };
  }

  upsertMany(collectionName, records, keyField = "id") {
    const payload = this.readCollectionPayload(collectionName);
    const computed = this.buildUpsertResult(payload.records, records, keyField);
    this.writeCollection(collectionName, computed.records, payload);
    return computed.result;
  }

  replaceCollection(collectionName, records) {
    const payload = this.readCollectionPayload(collectionName);
    const nextRecords = Array.isArray(records) ? records : [];
    this.writeCollection(collectionName, nextRecords, payload);
    return { replaced: true, totalAfter: nextRecords.length };
  }

  applyTransaction(operations) {
    this.assertInitialized();
    const received = Array.isArray(operations) ? operations : [];
    const snapshots = new Map();
    const computedPayloads = new Map();
    const results = {};
    const written = [];

    received.forEach((operation) => {
      const collection = sanitizeCollectionName(operation.collection);
      const currentPayload = this.readCollectionPayload(collection);
      snapshots.set(collection, cloneJson(currentPayload));

      if (operation.mode === "replace") {
        const records = Array.isArray(operation.records) ? cloneJson(operation.records) : [];
        computedPayloads.set(collection, {
          collection,
          databaseVersion: DATABASE_VERSION,
          createdAt: currentPayload.createdAt || nowIso(),
          updatedAt: nowIso(),
          records
        });
        results[collection] = { replaced: true, totalAfter: records.length };
        return;
      }

      const computed = this.buildUpsertResult(
        currentPayload.records,
        operation.records,
        operation.keyField || "id"
      );
      computedPayloads.set(collection, {
        collection,
        databaseVersion: DATABASE_VERSION,
        createdAt: currentPayload.createdAt || nowIso(),
        updatedAt: nowIso(),
        records: computed.records
      });
      results[collection] = computed.result;
    });

    try {
      computedPayloads.forEach((payload, collection) => {
        this.writeJsonAtomic(this.collectionPath(collection), payload);
        written.push(collection);
      });
    } catch (error) {
      written.reverse().forEach((collection) => {
        try { this.writeJsonAtomic(this.collectionPath(collection), snapshots.get(collection)); } catch (_rollbackError) { /* Se conserva respaldo. */ }
      });
      throw new Error(`No se pudo completar la transacción local: ${error.message}`);
    }

    const metadata = this.readJson(this.metadataPath, {});
    this.writeJsonAtomic(this.metadataPath, { ...metadata, updatedAt: nowIso() });

    return {
      ok: true,
      operationCount: received.length,
      collections: results
    };
  }

  find(collectionName, predicate = null) {
    const records = this.readCollection(collectionName);
    if (typeof predicate !== "function") return records;
    return records.filter(predicate);
  }

  listCollections() {
    this.assertInitialized();
    return fs.readdirSync(this.collectionsDirectory)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.slice(0, -5))
      .sort();
  }

  getSummary() {
    this.assertInitialized();
    const collections = this.listCollections();
    const counts = {};
    let totalRecords = 0;

    collections.forEach((collection) => {
      const count = this.readCollectionPayload(collection).records.length;
      counts[collection] = count;
      totalRecords += count;
    });

    const documents = counts._documents ? this.readCollection("_documents") : [];
    const runs = counts._processing_runs ? this.readCollection("_processing_runs") : [];
    const activeDocuments = documents.filter((record) => record.activo !== false && record.estado_version !== "SUPERADO");
    const tableCollections = collections.filter((name) => !name.startsWith("_"));
    const tableRows = tableCollections.reduce((sum, name) => sum + Number(counts[name] || 0), 0);

    return {
      ok: true,
      databasePath: this.rootDirectory,
      databaseVersion: DATABASE_VERSION,
      collectionCount: collections.length,
      tableCollectionCount: tableCollections.length,
      totalRecords,
      tableRows,
      documentCount: documents.length,
      activeDocumentCount: activeDocuments.length,
      processingRunCount: runs.length,
      lastUpdatedAt: this.readJson(this.metadataPath, {}).updatedAt || "",
      counts
    };
  }
}

module.exports = {
  DATABASE_VERSION,
  COLLECTION_NAME_PATTERN,
  nowIso,
  ensureDirectory,
  sanitizeCollectionName,
  LocalDatabase
};
