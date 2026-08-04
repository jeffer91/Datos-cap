/* =========================================================
Nombre completo: firebase-sync.service.js
Ruta o ubicación: /src/firebase/firebase-sync.service.js
Función o funciones:
- Mantener la base local como fuente principal y Firebase como respaldo automático.
- Autenticar con correo y contraseña sin exponer credenciales en el repositorio.
- Subir únicamente colecciones cuyo contenido cambió.
- Restaurar datos remotos solo cuando la colección local está vacía o no cambió.
- Evitar que un Firebase vacío elimine información local.
- Dividir colecciones grandes en bloques seguros para Cloud Firestore.
========================================================= */
"use strict";

const crypto = require("crypto");
const {
  FIREBASE_CONFIG,
  FIREBASE_APP_NAME,
  FIREBASE_ROOT_COLLECTION
} = require("./firebase.config");

const SETTINGS_COLLECTION = "_firebase_settings";
const STATE_COLLECTION = "_firebase_sync_state";
const SETTINGS_ID = "main";
const STATE_ID = "main";
const SCHEMA_VERSION = 1;
const MAX_CHUNK_BYTES = 450000;
const MAX_CHUNK_RECORDS = 250;
const STARTUP_DELAY_MS = 10000;
const DAILY_SYNC_HOUR = 19;
const EXCLUDED_COLLECTIONS = new Set([
  SETTINGS_COLLECTION,
  STATE_COLLECTION,
  "informe_cumplimiento_ia_config"
]);

function nowIso() { return new Date().toISOString(); }
function text(value) { return String(value == null ? "" : value).trim(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function list(value) { return Array.isArray(value) ? value : []; }

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stableValue(value[key]);
    return output;
  }, {});
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function hashRecords(records) {
  return sha256(stableStringify(list(records)));
}

function collectionDocumentId(collectionName) {
  return crypto.createHash("sha1").update(text(collectionName)).digest("hex");
}

function splitRecordsIntoChunks(records, options = {}) {
  const maxBytes = Math.max(50000, Number(options.maxBytes || MAX_CHUNK_BYTES));
  const maxRecords = Math.max(1, Number(options.maxRecords || MAX_CHUNK_RECORDS));
  const rows = list(records).map(clone);
  if (!rows.length) return [];

  const chunks = [];
  let current = [];
  let currentBytes = 2;

  rows.forEach((record) => {
    const recordJson = JSON.stringify(record);
    const recordBytes = Buffer.byteLength(recordJson, "utf8") + 1;
    const overLimit = current.length && (current.length >= maxRecords || currentBytes + recordBytes > maxBytes);
    if (overLimit) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(record);
    currentBytes += recordBytes;
  });

  if (current.length) chunks.push(current);
  return chunks;
}

function recordIdentity(record) {
  const row = record && typeof record === "object" ? record : {};
  const candidates = [
    "id", "id_documento", "id_docente", "id_capacitacion", "id_registro",
    "id_fila", "id_participante", "id_objetivo", "id_indicador", "cedula",
    "hash_archivo", "ruta_archivo"
  ];
  for (const field of candidates) {
    const value = text(row[field]);
    if (value) return `${field}:${value}`;
  }
  return `hash:${sha256(stableStringify(row))}`;
}

function mergeRemoteWithLocal(remoteRecords, localRecords) {
  const merged = new Map();
  list(remoteRecords).forEach((record) => merged.set(recordIdentity(record), clone(record)));
  list(localRecords).forEach((record) => merged.set(recordIdentity(record), clone(record)));
  return [...merged.values()];
}

function maskEmail(email) {
  const clean = text(email);
  const parts = clean.split("@");
  if (parts.length !== 2) return clean;
  const name = parts[0];
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, name.length - visible.length))}@${parts[1]}`;
}

function nextDailyDelay(now = new Date(), hour = DAILY_SYNC_HOUR) {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function loadFirebaseSdk() {
  const appSdk = require("firebase/app");
  const authSdk = require("firebase/auth");
  const firestoreSdk = require("firebase/firestore");
  return { appSdk, authSdk, firestoreSdk };
}

class FirebaseSyncService {
  constructor(database, options = {}) {
    if (!database) throw new Error("FirebaseSyncService requiere la base local.");
    this.database = database;
    this.secretStore = options.secretStore || {};
    this.onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
    this.logger = options.logger || console;
    this.config = options.config || FIREBASE_CONFIG;
    this.firebaseApp = null;
    this.auth = null;
    this.firestore = null;
    this.currentUser = null;
    this.running = false;
    this.started = false;
    this.applyingRemote = false;
    this.startupTimer = null;
    this.dailyTimer = null;
    this.dailyInterval = null;
    this.unsubscribeDatabase = null;
    this.runtimeStatus = {
      state: "UNCONFIGURED",
      message: "Firebase no está configurado.",
      projectId: this.config.projectId,
      lastSyncAt: "",
      pendingChanges: false,
      error: ""
    };
  }

  readCollectionSafe(name) {
    try { return this.database.readCollection(name); }
    catch (_error) { return []; }
  }

  readSettings() {
    return this.readCollectionSafe(SETTINGS_COLLECTION).find((row) => row.id === SETTINGS_ID) || null;
  }

  readSyncState() {
    return this.readCollectionSafe(STATE_COLLECTION).find((row) => row.id === STATE_ID) || {
      id: STATE_ID,
      collections: {},
      lastSyncAt: "",
      lastPullAt: "",
      lastPushAt: "",
      pendingChanges: false,
      lastError: ""
    };
  }

  writeSyncState(patch = {}) {
    const current = this.readSyncState();
    const row = {
      ...current,
      ...clone(patch),
      id: STATE_ID,
      updatedAt: nowIso()
    };
    this.database.upsertMany(STATE_COLLECTION, [row], "id");
    return row;
  }

  credentials() {
    const settings = this.readSettings();
    if (!settings?.enabled || !settings.email || !settings.passwordEncrypted) return null;
    let password = "";
    try {
      password = typeof this.secretStore.decrypt === "function"
        ? this.secretStore.decrypt(settings.passwordEncrypted)
        : "";
    } catch (_error) {
      password = "";
    }
    if (!password) return null;
    return { email: settings.email, password };
  }

  publicStatus() {
    const settings = this.readSettings();
    const state = this.readSyncState();
    return {
      ...this.runtimeStatus,
      configured: Boolean(settings?.enabled && settings.email && settings.passwordEncrypted),
      email: settings?.email || "",
      emailMasked: maskEmail(settings?.email || ""),
      projectId: this.config.projectId,
      lastSyncAt: state.lastSyncAt || this.runtimeStatus.lastSyncAt || "",
      lastPullAt: state.lastPullAt || "",
      lastPushAt: state.lastPushAt || "",
      pendingChanges: Boolean(state.pendingChanges),
      uid: this.currentUser?.uid || ""
    };
  }

  setRuntimeStatus(state, message, extras = {}) {
    this.runtimeStatus = {
      ...this.runtimeStatus,
      state,
      message: text(message),
      error: state === "ERROR" ? text(extras.error || message) : "",
      ...extras
    };
    try { this.onStatus(this.publicStatus()); }
    catch (_error) { /* la interfaz puede no estar lista todavía */ }
  }

  configure(input = {}) {
    const email = text(input.email).toLowerCase();
    const password = String(input.password || "");
    if (!email || !email.includes("@")) throw new Error("Ingresa un correo válido.");
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
    const encrypted = typeof this.secretStore.encrypt === "function"
      ? this.secretStore.encrypt(password)
      : "";
    if (!encrypted) throw new Error("Windows no permitió cifrar la contraseña localmente.");

    const row = {
      id: SETTINGS_ID,
      enabled: true,
      email,
      passwordEncrypted: encrypted,
      projectId: this.config.projectId,
      updatedAt: nowIso()
    };
    this.database.upsertMany(SETTINGS_COLLECTION, [row], "id");
    this.currentUser = null;
    this.setRuntimeStatus("CONNECTING", "Conectando con Firebase...");
    return this.syncNow({ reason: "configuration" });
  }

  async disconnect() {
    try {
      if (this.auth) {
        const { authSdk } = loadFirebaseSdk();
        await authSdk.signOut(this.auth);
      }
    } catch (_error) { /* cerrar sesión es de mejor esfuerzo */ }
    this.currentUser = null;
    this.database.replaceCollection(SETTINGS_COLLECTION, []);
    this.setRuntimeStatus("UNCONFIGURED", "Firebase desconectado.");
    return this.publicStatus();
  }

  markLocalChange(collectionName) {
    if (this.applyingRemote || EXCLUDED_COLLECTIONS.has(collectionName)) return;
    const state = this.readSyncState();
    const pendingCollections = new Set(list(state.pendingCollections));
    pendingCollections.add(collectionName);
    this.writeSyncState({
      pendingChanges: true,
      pendingCollections: [...pendingCollections].sort()
    });
    this.runtimeStatus.pendingChanges = true;
    try { this.onStatus(this.publicStatus()); }
    catch (_error) { /* sin acción */ }
  }

  start() {
    if (this.started) return this.publicStatus();
    this.started = true;
    if (typeof this.database.onChange === "function") {
      this.unsubscribeDatabase = this.database.onChange((event) => this.markLocalChange(event.collection));
    }
    this.startupTimer = setTimeout(() => {
      this.syncNow({ reason: "startup" }).catch((error) => this.logger.warn("Firebase startup sync:", error.message));
    }, STARTUP_DELAY_MS);
    this.scheduleDailySync();
    const configured = Boolean(this.credentials());
    this.setRuntimeStatus(
      configured ? "WAITING" : "UNCONFIGURED",
      configured ? "Firebase listo para sincronizar." : "Firebase no está configurado."
    );
    return this.publicStatus();
  }

  stop() {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.dailyTimer) clearTimeout(this.dailyTimer);
    if (this.dailyInterval) clearInterval(this.dailyInterval);
    if (typeof this.unsubscribeDatabase === "function") this.unsubscribeDatabase();
    this.startupTimer = null;
    this.dailyTimer = null;
    this.dailyInterval = null;
    this.unsubscribeDatabase = null;
    this.started = false;
  }

  scheduleDailySync() {
    const delay = nextDailyDelay(new Date(), DAILY_SYNC_HOUR);
    this.dailyTimer = setTimeout(() => {
      this.syncNow({ reason: "daily" }).catch((error) => this.logger.warn("Firebase daily sync:", error.message));
      this.dailyInterval = setInterval(() => {
        this.syncNow({ reason: "daily" }).catch((error) => this.logger.warn("Firebase daily sync:", error.message));
      }, 24 * 60 * 60 * 1000);
    }, delay);
  }

  async connect() {
    const credentials = this.credentials();
    if (!credentials) throw new Error("Configura el correo y la contraseña de Firebase.");
    if (this.currentUser && this.auth?.currentUser) return this.currentUser;

    const { appSdk, authSdk, firestoreSdk } = loadFirebaseSdk();
    this.firebaseApp = appSdk.getApps().find((item) => item.name === FIREBASE_APP_NAME)
      || appSdk.initializeApp(this.config, FIREBASE_APP_NAME);
    this.auth = authSdk.getAuth(this.firebaseApp);
    try {
      this.firestore = firestoreSdk.initializeFirestore(this.firebaseApp, {
        ignoreUndefinedProperties: true
      });
    } catch (_error) {
      this.firestore = firestoreSdk.getFirestore(this.firebaseApp);
    }
    const result = await authSdk.signInWithEmailAndPassword(
      this.auth,
      credentials.email,
      credentials.password
    );
    this.currentUser = result.user;
    return this.currentUser;
  }

  userDocumentRef() {
    if (!this.firestore || !this.currentUser?.uid) throw new Error("Firebase no está conectado.");
    const { firestoreSdk } = loadFirebaseSdk();
    return firestoreSdk.doc(this.firestore, FIREBASE_ROOT_COLLECTION, this.currentUser.uid);
  }

  collectionsRef() {
    const { firestoreSdk } = loadFirebaseSdk();
    return firestoreSdk.collection(this.userDocumentRef(), "colecciones");
  }

  metadataRef(collectionName) {
    const { firestoreSdk } = loadFirebaseSdk();
    return firestoreSdk.doc(this.collectionsRef(), collectionDocumentId(collectionName));
  }

  chunksRef(collectionName) {
    const { firestoreSdk } = loadFirebaseSdk();
    return firestoreSdk.collection(this.metadataRef(collectionName), "bloques");
  }

  async readRemoteRecords(collectionName, expectedChunks = 0) {
    const { firestoreSdk } = loadFirebaseSdk();
    const snapshot = await firestoreSdk.getDocs(this.chunksRef(collectionName));
    const chunks = snapshot.docs
      .map((document) => document.data())
      .sort((left, right) => Number(left.index || 0) - Number(right.index || 0));
    if (expectedChunks && chunks.length < expectedChunks) {
      throw new Error(`El respaldo remoto de ${collectionName} está incompleto.`);
    }
    return chunks.flatMap((chunk) => {
      try { return list(JSON.parse(String(chunk.payload || "[]"))); }
      catch (_error) { throw new Error(`No se pudo leer un bloque remoto de ${collectionName}.`); }
    });
  }

  async writeRemoteRecords(collectionName, records, hash) {
    const { firestoreSdk } = loadFirebaseSdk();
    const metadataReference = this.metadataRef(collectionName);
    const existing = await firestoreSdk.getDoc(metadataReference);
    const previousChunks = existing.exists() ? Number(existing.data().chunkCount || 0) : 0;
    const chunks = splitRecordsIntoChunks(records);

    for (let index = 0; index < chunks.length; index += 1) {
      const payload = JSON.stringify(chunks[index]);
      const chunkReference = firestoreSdk.doc(this.chunksRef(collectionName), String(index).padStart(6, "0"));
      await firestoreSdk.setDoc(chunkReference, {
        index,
        payload,
        bytes: Buffer.byteLength(payload, "utf8"),
        hash: sha256(payload),
        updatedAt: nowIso()
      });
    }
    for (let index = chunks.length; index < previousChunks; index += 1) {
      const staleReference = firestoreSdk.doc(this.chunksRef(collectionName), String(index).padStart(6, "0"));
      await firestoreSdk.deleteDoc(staleReference);
    }

    await firestoreSdk.setDoc(metadataReference, {
      collectionName,
      collectionId: collectionDocumentId(collectionName),
      hash,
      recordCount: records.length,
      chunkCount: chunks.length,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso()
    });
  }

  async pullRemote(syncState) {
    const { firestoreSdk } = loadFirebaseSdk();
    const snapshot = await firestoreSdk.getDocs(this.collectionsRef());
    const collectionState = { ...(syncState.collections || {}) };
    let restored = 0;
    let replaced = 0;
    let preservedLocal = 0;

    for (const metadataDocument of snapshot.docs) {
      const metadata = metadataDocument.data() || {};
      const collectionName = text(metadata.collectionName);
      if (!collectionName || EXCLUDED_COLLECTIONS.has(collectionName)) continue;
      const remoteHash = text(metadata.hash);
      const localRecords = this.readCollectionSafe(collectionName);
      const localHash = hashRecords(localRecords);
      const lastSyncedHash = text(collectionState[collectionName]?.lastSyncedHash);

      if (localHash === remoteHash) {
        collectionState[collectionName] = {
          ...(collectionState[collectionName] || {}),
          lastSyncedHash: remoteHash,
          lastPulledAt: nowIso()
        };
        continue;
      }

      if (!localRecords.length && Number(metadata.recordCount || 0) > 0) {
        const remoteRecords = await this.readRemoteRecords(collectionName, Number(metadata.chunkCount || 0));
        this.applyingRemote = true;
        try { this.database.replaceCollection(collectionName, remoteRecords); }
        finally { this.applyingRemote = false; }
        restored += 1;
        collectionState[collectionName] = {
          ...(collectionState[collectionName] || {}),
          lastSyncedHash: remoteHash,
          lastPulledAt: nowIso()
        };
        continue;
      }

      if (lastSyncedHash && localHash === lastSyncedHash && remoteHash !== lastSyncedHash) {
        const remoteRecords = await this.readRemoteRecords(collectionName, Number(metadata.chunkCount || 0));
        this.applyingRemote = true;
        try { this.database.replaceCollection(collectionName, remoteRecords); }
        finally { this.applyingRemote = false; }
        replaced += 1;
        collectionState[collectionName] = {
          ...(collectionState[collectionName] || {}),
          lastSyncedHash: remoteHash,
          lastPulledAt: nowIso()
        };
        continue;
      }

      preservedLocal += 1;
    }

    return { collectionState, restored, replaced, preservedLocal };
  }

  async pushLocal(collectionState) {
    const { firestoreSdk } = loadFirebaseSdk();
    const collections = this.database.listCollections()
      .filter((name) => !EXCLUDED_COLLECTIONS.has(name));
    let uploaded = 0;
    let skipped = 0;

    await firestoreSdk.setDoc(this.userDocumentRef(), {
      projectId: this.config.projectId,
      app: "Datos-cap",
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso()
    }, { merge: true });

    for (const collectionName of collections) {
      const records = this.readCollectionSafe(collectionName);
      const localHash = hashRecords(records);
      const metadataReference = this.metadataRef(collectionName);
      const remote = await firestoreSdk.getDoc(metadataReference);
      const remoteHash = remote.exists() ? text(remote.data().hash) : "";
      if (remoteHash === localHash) {
        skipped += 1;
      } else {
        await this.writeRemoteRecords(collectionName, records, localHash);
        uploaded += 1;
      }
      collectionState[collectionName] = {
        ...(collectionState[collectionName] || {}),
        lastSyncedHash: localHash,
        lastPushedAt: nowIso(),
        recordCount: records.length
      };
    }

    return { collectionState, uploaded, skipped };
  }

  async syncNow(options = {}) {
    if (this.running) return { ok: true, skipped: true, status: this.publicStatus() };
    if (!this.credentials()) {
      this.setRuntimeStatus("UNCONFIGURED", "Firebase no está configurado.");
      return { ok: false, configured: false, status: this.publicStatus() };
    }

    this.running = true;
    const startedAt = nowIso();
    this.setRuntimeStatus("CONNECTING", "Conectando con Firebase...", { reason: options.reason || "automatic" });
    try {
      await this.connect();
      this.setRuntimeStatus("SYNCING", "Sincronizando cambios...");
      const currentState = this.readSyncState();
      const pulled = await this.pullRemote(currentState);
      const pushed = await this.pushLocal(pulled.collectionState);
      const completedAt = nowIso();
      this.writeSyncState({
        collections: pushed.collectionState,
        lastSyncAt: completedAt,
        lastPullAt: completedAt,
        lastPushAt: completedAt,
        pendingChanges: false,
        pendingCollections: [],
        lastError: "",
        lastResult: {
          reason: options.reason || "automatic",
          startedAt,
          completedAt,
          restored: pulled.restored,
          replaced: pulled.replaced,
          preservedLocal: pulled.preservedLocal,
          uploaded: pushed.uploaded,
          skipped: pushed.skipped
        }
      });
      this.setRuntimeStatus("READY", "Firebase sincronizado.", {
        lastSyncAt: completedAt,
        pendingChanges: false,
        uploaded: pushed.uploaded,
        restored: pulled.restored + pulled.replaced
      });
      return {
        ok: true,
        pulled,
        pushed,
        status: this.publicStatus()
      };
    } catch (error) {
      const message = this.friendlyError(error);
      this.writeSyncState({ lastError: message, pendingChanges: true });
      this.setRuntimeStatus("ERROR", message, { error: message, pendingChanges: true });
      throw new Error(message);
    } finally {
      this.running = false;
    }
  }

  friendlyError(error) {
    const code = text(error?.code).toLowerCase();
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
      return "Correo o contraseña de Firebase incorrectos.";
    }
    if (code.includes("auth/operation-not-allowed")) return "Activa el acceso con correo y contraseña en Firebase Authentication.";
    if (code.includes("permission-denied")) return "Firestore rechazó el acceso. Publica las reglas incluidas en el proyecto.";
    if (code.includes("network") || code.includes("unavailable")) return "Sin conexión con Firebase. La información continúa guardada localmente.";
    return text(error?.message) || "No se pudo sincronizar con Firebase.";
  }
}

function createFirebaseSyncService(database, options = {}) {
  return new FirebaseSyncService(database, options);
}

module.exports = {
  SETTINGS_COLLECTION,
  STATE_COLLECTION,
  EXCLUDED_COLLECTIONS,
  stableStringify,
  hashRecords,
  collectionDocumentId,
  splitRecordsIntoChunks,
  recordIdentity,
  mergeRemoteWithLocal,
  maskEmail,
  nextDailyDelay,
  FirebaseSyncService,
  createFirebaseSyncService
};
