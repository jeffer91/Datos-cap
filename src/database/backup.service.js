/* =========================================================
Nombre completo: backup.service.js
Ruta o ubicación: /src/database/backup.service.js
Función o funciones:
- Crear respaldos completos y comprimidos de la base local.
- Validar formato, versión, estructura y checksum SHA-256.
- Restaurar en modo reemplazo o combinación con respaldo de seguridad previo.
- Generar respaldos automáticos y aplicar políticas de retención.
========================================================= */

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const {
  DATABASE_VERSION,
  ensureDirectory,
  sanitizeCollectionName,
  nowIso
} = require("./local-database");

const BACKUP_FORMAT = "DATOS_CAP_BACKUP";
const BACKUP_FORMAT_VERSION = 1;
const BACKUP_EXTENSION = ".capbackup";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((output, key) => {
      output[key] = canonicalize(value[key]);
      return output;
    }, {});
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function calculateChecksum(value) {
  return crypto.createHash("sha256").update(canonicalStringify(value), "utf8").digest("hex");
}

function safeFilePart(value) {
  return String(value || "backup")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "backup";
}

function backupTimestamp(date = new Date()) {
  const iso = date.toISOString();
  return iso
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .replace("Z", "")
    .replace(".", "_");
}

function ensureBackupExtension(filePath) {
  const target = path.resolve(String(filePath || "").trim());
  if (!target) throw new Error("Debes indicar una ruta para el respaldo.");
  return target.toLowerCase().endsWith(BACKUP_EXTENSION)
    ? target
    : `${target}${BACKUP_EXTENSION}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function countBackupRecords(collections) {
  return Object.values(collections || {}).reduce((sum, records) => {
    return sum + (Array.isArray(records) ? records.length : 0);
  }, 0);
}

function validateBackupPayload(payload) {
  const errors = [];
  const warnings = [];

  if (!payload || typeof payload !== "object") {
    return { ok: false, errors: ["El archivo no contiene un respaldo válido."], warnings: [] };
  }
  if (payload.format !== BACKUP_FORMAT) errors.push("El formato del respaldo no pertenece a esta aplicación.");
  if (Number(payload.formatVersion) !== BACKUP_FORMAT_VERSION) errors.push("La versión del formato de respaldo no es compatible.");
  if (!payload.createdAt) errors.push("El respaldo no contiene fecha de creación.");
  if (!payload.data || typeof payload.data !== "object") errors.push("El respaldo no contiene el bloque de datos.");
  if (!payload.data || !payload.data.metadata || typeof payload.data.metadata !== "object") errors.push("El respaldo no contiene metadatos de la base.");
  if (!payload.data || !payload.data.collections || typeof payload.data.collections !== "object" || Array.isArray(payload.data.collections)) {
    errors.push("El respaldo no contiene colecciones válidas.");
  }

  const collections = payload.data && payload.data.collections && typeof payload.data.collections === "object"
    ? payload.data.collections
    : {};

  Object.entries(collections).forEach(([collection, records]) => {
    try {
      sanitizeCollectionName(collection);
    } catch (error) {
      errors.push(error.message);
    }
    if (!Array.isArray(records)) errors.push(`La colección ${collection} no contiene un arreglo de registros.`);
  });

  const expectedChecksum = payload.checksum && payload.checksum.value;
  if (!expectedChecksum) {
    errors.push("El respaldo no contiene checksum de integridad.");
  } else {
    const unsignedPayload = cloneJson(payload);
    delete unsignedPayload.checksum;
    const actualChecksum = calculateChecksum(unsignedPayload);
    if (actualChecksum !== expectedChecksum) errors.push("El checksum no coincide; el respaldo está alterado o dañado.");
  }

  const sourceDatabaseVersion = Number(payload.data && payload.data.metadata && payload.data.metadata.databaseVersion);
  if (sourceDatabaseVersion > DATABASE_VERSION) {
    errors.push("El respaldo pertenece a una versión de base más reciente que esta aplicación.");
  } else if (sourceDatabaseVersion && sourceDatabaseVersion < DATABASE_VERSION) {
    warnings.push("El respaldo pertenece a una versión anterior de la base y será normalizado al restaurarse.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      createdAt: payload.createdAt || "",
      appVersion: payload.appVersion || "",
      databaseVersion: sourceDatabaseVersion || "",
      collectionCount: Object.keys(collections).length,
      recordCount: countBackupRecords(collections),
      reason: payload.reason || "manual"
    }
  };
}

class BackupService {
  constructor(localDatabase, options = {}) {
    if (!localDatabase) throw new Error("El servicio de respaldos requiere una base local.");
    this.database = localDatabase;
    this.appVersion = String(options.appVersion || "").trim();
    this.backupDirectory = path.resolve(options.backupDirectory || path.join(localDatabase.rootDirectory, "backups"));
    this.defaultRetention = Math.max(3, Math.min(Number(options.defaultRetention || 20), 100));
    ensureDirectory(this.backupDirectory);
  }

  captureDatabase() {
    const collectionNames = this.database.listCollections();
    const collections = collectionNames.reduce((output, collection) => {
      output[collection] = this.database.readCollection(collection);
      return output;
    }, {});
    const metadata = this.database.readJson(this.database.metadataPath, {
      databaseVersion: DATABASE_VERSION,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    return {
      metadata: cloneJson(metadata),
      collections,
      summary: {
        collectionCount: collectionNames.length,
        recordCount: countBackupRecords(collections)
      }
    };
  }

  createPayload(options = {}) {
    const snapshot = this.captureDatabase();
    const unsignedPayload = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: nowIso(),
      appVersion: this.appVersion,
      reason: String(options.reason || "manual").trim() || "manual",
      source: {
        databasePath: this.database.rootDirectory,
        platform: process.platform,
        nodeVersion: process.version
      },
      summary: snapshot.summary,
      data: {
        metadata: snapshot.metadata,
        collections: snapshot.collections
      }
    };

    return {
      ...unsignedPayload,
      checksum: {
        algorithm: "sha256",
        value: calculateChecksum(unsignedPayload)
      }
    };
  }

  writePayload(filePath, payload) {
    const targetPath = ensureBackupExtension(filePath);
    ensureDirectory(path.dirname(targetPath));
    const temporaryPath = `${targetPath}.tmp`;
    const jsonBuffer = Buffer.from(JSON.stringify(payload), "utf8");
    const compressed = zlib.gzipSync(jsonBuffer, { level: 9 });

    fs.writeFileSync(temporaryPath, compressed);
    try {
      fs.renameSync(temporaryPath, targetPath);
    } catch (error) {
      try { if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath); } catch (_cleanupError) { /* Sin acción. */ }
      throw error;
    }

    return {
      ok: true,
      filePath: targetPath,
      fileName: path.basename(targetPath),
      sizeBytes: fs.statSync(targetPath).size,
      createdAt: payload.createdAt,
      checksum: payload.checksum.value,
      collectionCount: payload.summary.collectionCount,
      recordCount: payload.summary.recordCount,
      reason: payload.reason
    };
  }

  createBackup(filePath, options = {}) {
    const payload = this.createPayload(options);
    return this.writePayload(filePath, payload);
  }

  readBackup(filePath) {
    const sourcePath = path.resolve(String(filePath || "").trim());
    if (!sourcePath || !fs.existsSync(sourcePath)) throw new Error("El archivo de respaldo no existe.");
    if (!fs.statSync(sourcePath).isFile()) throw new Error("La ruta seleccionada no corresponde a un archivo.");

    try {
      const compressed = fs.readFileSync(sourcePath);
      const json = zlib.gunzipSync(compressed).toString("utf8");
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`No se pudo abrir el respaldo: ${error.message}`);
    }
  }

  validateBackup(filePath) {
    try {
      const payload = this.readBackup(filePath);
      const validation = validateBackupPayload(payload);
      return {
        ...validation,
        filePath: path.resolve(filePath),
        fileName: path.basename(filePath),
        payload: validation.ok ? payload : null
      };
    } catch (error) {
      return {
        ok: false,
        filePath: String(filePath || ""),
        fileName: path.basename(String(filePath || "")),
        errors: [error.message],
        warnings: [],
        summary: {},
        payload: null
      };
    }
  }

  createAutomaticBackup(reason = "automatico", options = {}) {
    ensureDirectory(this.backupDirectory);
    const name = `datos-cap_${backupTimestamp()}_${safeFilePart(reason)}${BACKUP_EXTENSION}`;
    const result = this.createBackup(path.join(this.backupDirectory, name), { reason });
    const retention = Math.max(1, Math.min(Number(options.retention || this.defaultRetention), 100));
    result.prunedFiles = this.pruneAutomaticBackups(retention);
    return result;
  }

  ensureDailyBackup() {
    const summary = this.database.getSummary();
    if (!summary.documentCount) {
      return { ok: true, created: false, reason: "empty-database" };
    }

    const today = new Date().toISOString().slice(0, 10);
    const existing = this.listAutomaticBackups().find((backup) => backup.createdAt.slice(0, 10) === today);
    if (existing) return { ok: true, created: false, reason: "already-created-today", backup: existing };

    return { ok: true, created: true, backup: this.createAutomaticBackup("respaldo-diario") };
  }

  listAutomaticBackups() {
    ensureDirectory(this.backupDirectory);
    return fs.readdirSync(this.backupDirectory)
      .filter((fileName) => fileName.toLowerCase().endsWith(BACKUP_EXTENSION))
      .map((fileName) => {
        const filePath = path.join(this.backupDirectory, fileName);
        const stat = fs.statSync(filePath);
        return {
          fileName,
          filePath,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString()
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  pruneAutomaticBackups(retention = this.defaultRetention) {
    const backups = this.listAutomaticBackups();
    const removed = [];
    backups.slice(retention).forEach((backup) => {
      try {
        fs.unlinkSync(backup.filePath);
        removed.push(backup.filePath);
      } catch (_error) {
        // Un archivo bloqueado se conserva para no arriesgar su contenido.
      }
    });
    return removed;
  }

  getSummary() {
    const backups = this.listAutomaticBackups();
    const lastBackup = backups[0] || null;
    return {
      ok: true,
      backupDirectory: this.backupDirectory,
      automaticBackupCount: backups.length,
      totalSizeBytes: backups.reduce((sum, backup) => sum + backup.sizeBytes, 0),
      lastBackup
    };
  }

  buildMergeRecords(existingRecords, incomingRecords) {
    const existing = Array.isArray(existingRecords) ? cloneJson(existingRecords) : [];
    const incoming = Array.isArray(incomingRecords) ? incomingRecords : [];
    const allHaveId = incoming.every((record) => record && String(record.id || "").trim());

    if (allHaveId) {
      return this.database.buildUpsertResult(existing, incoming, "id").records;
    }

    const seen = new Set(existing.map((record) => canonicalStringify(record)));
    incoming.forEach((record) => {
      const key = canonicalStringify(record);
      if (!seen.has(key)) {
        existing.push(cloneJson(record));
        seen.add(key);
      }
    });
    return existing;
  }

  applySnapshot(snapshot, mode) {
    const incomingCollections = snapshot.collections || {};
    const existingCollections = this.database.listCollections();
    const collectionNames = mode === "replace"
      ? [...new Set([...existingCollections, ...Object.keys(incomingCollections)])]
      : Object.keys(incomingCollections);

    const operations = collectionNames.map((collection) => {
      const incoming = Array.isArray(incomingCollections[collection]) ? incomingCollections[collection] : [];
      if (mode === "replace") return { collection, mode: "replace", records: incoming };

      const merged = this.buildMergeRecords(this.database.readCollection(collection), incoming);
      return { collection, mode: "replace", records: merged };
    });

    this.database.applyTransaction(operations);
    const currentMetadata = this.database.readJson(this.database.metadataPath, {});
    this.database.writeJsonAtomic(this.database.metadataPath, {
      ...currentMetadata,
      databaseVersion: DATABASE_VERSION,
      restoredAt: nowIso(),
      restoredMode: mode,
      sourceBackupCreatedAt: snapshot.metadata && snapshot.metadata.updatedAt || "",
      updatedAt: nowIso()
    });
  }

  restoreBackup(filePath, options = {}) {
    const mode = options.mode === "merge" ? "merge" : "replace";
    const validation = this.validateBackup(filePath);
    if (!validation.ok) {
      throw new Error(validation.errors.join(" ") || "El respaldo no superó la validación.");
    }

    const safetyBackup = this.createAutomaticBackup("antes-de-restaurar", { retention: this.defaultRetention });
    const previousSnapshot = this.captureDatabase();

    try {
      this.applySnapshot(validation.payload.data, mode);
      const summary = this.database.getSummary();
      return {
        ok: true,
        mode,
        sourceFilePath: path.resolve(filePath),
        sourceFileName: path.basename(filePath),
        restoredAt: nowIso(),
        safetyBackup,
        validation: {
          warnings: validation.warnings,
          summary: validation.summary
        },
        databaseSummary: summary
      };
    } catch (error) {
      try {
        this.applySnapshot(previousSnapshot, "replace");
      } catch (_rollbackError) {
        throw new Error(`La restauración falló y la reversión automática también tuvo problemas. Respaldo de seguridad: ${safetyBackup.filePath}. Error original: ${error.message}`);
      }
      throw new Error(`La restauración falló y fue revertida: ${error.message}`);
    }
  }
}

function createBackupService(localDatabase, options = {}) {
  return new BackupService(localDatabase, options);
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_EXTENSION,
  canonicalize,
  canonicalStringify,
  calculateChecksum,
  safeFilePart,
  backupTimestamp,
  ensureBackupExtension,
  countBackupRecords,
  validateBackupPayload,
  BackupService,
  createBackupService
};
