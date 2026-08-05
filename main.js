"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { PlanProcessingEngine } = require("./src/plan-pipeline");
const {
  applyPlanIntelligence,
  extractPeriod
} = require("./src/plan-intelligence");
const { DEFAULT_DEDICATION, validatePlanRecord } = require("./src/plan-validation");
const { isLocalAiEnabled, configuredModel } = require("./src/local-ai-review");
const { PlanStorage } = require("./src/storage");
const { exportExcel, exportJson } = require("./src/exporter");

const MAX_FILES = 500;
let mainWindow = null;
let storage = null;
let processing = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 980,
    minHeight: 650,
    title: "Datos-cap · Planes docentes",
    backgroundColor: "#f5f7fb",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function emitProgress(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("plans:progress", payload);
}

function uniquePdfPaths(filePaths) {
  const seen = new Set();
  const result = [];
  for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
    const resolved = path.resolve(String(filePath || ""));
    if (!resolved.toLowerCase().endsWith(".pdf")) continue;
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(resolved);
    if (result.length >= MAX_FILES) break;
  }
  return result;
}

function scanFolder(folderPath) {
  const files = [];
  const errors = [];
  const stack = [path.resolve(folderPath)];
  while (stack.length && files.length < MAX_FILES) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      errors.push({ path: current, message: error.message });
      continue;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) files.push(fullPath);
    }
  }
  return { files: uniquePdfPaths(files), errors, truncated: files.length >= MAX_FILES };
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function cleanString(value) {
  return String(value == null ? "" : value).replace(/\r\n?/g, "\n").trim();
}

function cleanList(value) {
  const source = Array.isArray(value) ? value : cleanString(value).split(/\n|\|/);
  return source.map(cleanString).filter(Boolean);
}

function sanitizeTraining(training, index) {
  const start = cleanString(training?.fecha_inicio_propuesta);
  const end = cleanString(training?.fecha_fin_propuesta);
  return {
    orden: index + 1,
    nombre: cleanString(training?.nombre),
    horas: Math.max(0, Number(training?.horas || 0)),
    fecha_inicio_propuesta: start,
    fecha_fin_propuesta: end,
    fecha_rango_original: [start, end].filter(Boolean).join(" hasta "),
    tipo: cleanString(training?.tipo),
    actividades_teoricas: cleanList(training?.actividades_teoricas),
    actividades_practicas: cleanList(training?.actividades_practicas),
    impacto_esperado: cleanString(training?.impacto_esperado),
    vision_largo_plazo: cleanString(training?.vision_largo_plazo),
    detalle_compartido_entre_capacitaciones: true
  };
}

function hasUsefulPlanData(record) {
  const diagnosticCount = Object.values(record?.diagnostico || {}).filter((value) => cleanString(value)).length;
  return Boolean(
    cleanString(record?.docente?.nombre)
    && cleanString(record?.docente?.carrera)
    && (diagnosticCount >= 2 || (record?.capacitaciones?.length || 0) > 0)
  );
}

function migrateStoredRecords() {
  const firstPass = storage.deduplicate();
  const records = storage.list();
  let migrated = 0;

  for (const current of records) {
    if (!current?.id) continue;
    try {
      let updated = applyPlanIntelligence(current, {
        fileName: current.archivo?.nombre || "",
        method: current.archivo?.metodo_lectura || "MIGRACION"
      });
      updated.docente = {
        ...(updated.docente || {}),
        tiempo_dedicacion: DEFAULT_DEDICATION
      };

      const useful = hasUsefulPlanData(updated);
      if (updated.estado === "NO_ES_PLAN" && useful) {
        updated.advertencias = (updated.advertencias || []).filter((item) =>
          !/no corresponde a un plan individual/i.test(String(item || ""))
        );
        updated.deteccion = {
          ...(updated.deteccion || {}),
          posible_plan: true,
          recuperado_por_migracion: true
        };
      }

      const validated = validatePlanRecord(updated, {
        isPlan: updated.estado !== "ERROR" && (updated.estado !== "NO_ES_PLAN" || useful),
        possiblePlan: useful,
        preserveError: true
      });

      if (JSON.stringify(validated) !== JSON.stringify(current)) {
        storage.updateById(current.id, validated);
        migrated += 1;
      }
    } catch (_error) {
      // El registro pudo fusionarse con otro durante la migración.
    }
  }

  const secondPass = storage.deduplicate();
  return {
    migrated,
    consolidated: firstPass.removed + secondPass.removed,
    total: storage.list().length
  };
}

function updatePlanRecord(payload = {}) {
  const id = cleanString(payload.id);
  const current = storage.list().find((item) => item?.id === id);
  if (!current) throw new Error("El plan ya no existe en la base local.");

  const code = cleanString(payload.docente?.codigo_documento);
  const period = cleanString(payload.docente?.periodo_plan) || extractPeriod(code);
  let updated = {
    ...current,
    docente: {
      nombre: cleanString(payload.docente?.nombre),
      carrera: cleanString(payload.docente?.carrera),
      tiempo_dedicacion: DEFAULT_DEDICATION,
      nivel_academico_actual: cleanString(payload.docente?.nivel_academico_actual),
      codigo_documento: code,
      periodo_plan: period
    },
    diagnostico: {
      capacitacion_12_meses: cleanString(payload.diagnostico?.capacitacion_12_meses),
      avances_aplicados: cleanString(payload.diagnostico?.avances_aplicados),
      comodidad_metodologias: cleanString(payload.diagnostico?.comodidad_metodologias),
      estrategias_pedagogicas: cleanString(payload.diagnostico?.estrategias_pedagogicas),
      herramientas_tecnologicas: cleanString(payload.diagnostico?.herramientas_tecnologicas),
      formacion_adicional: cleanString(payload.diagnostico?.formacion_adicional),
      tipo_formacion: cleanString(payload.diagnostico?.tipo_formacion)
    },
    capacitaciones: (Array.isArray(payload.capacitaciones) ? payload.capacitaciones : []).map(sanitizeTraining),
    correccion_manual: true,
    fecha_correccion: new Date().toISOString(),
    deteccion: {
      ...(current.deteccion || {}),
      confirmado_como_plan: true,
      posible_plan: true,
      confirmado_manualmente: true
    },
    advertencias: (current.advertencias || []).filter((item) =>
      !/requiere confirmaci[oó]n manual|no corresponde a un plan individual/i.test(String(item || ""))
    )
  };

  updated = applyPlanIntelligence(updated, {
    fileName: current.archivo?.nombre || "",
    method: "CORRECCION_MANUAL"
  });
  const validated = validatePlanRecord(updated, { isPlan: true, possiblePlan: true });
  const saved = storage.updateById(id, validated);
  return {
    ok: true,
    record: saved,
    records: storage.list(),
    summary: storage.getSummary()
  };
}

function errorRecord(filePath, error) {
  let size = 0;
  try { size = fs.statSync(filePath).size; } catch (_error) { /* sin acción */ }
  return {
    id: crypto.randomUUID(),
    archivo: {
      nombre: path.basename(filePath),
      ruta: filePath,
      hash: "",
      tamano: size,
      paginas: 0,
      metodo_lectura: "ERROR",
      fecha_procesamiento: new Date().toISOString()
    },
    docente: {
      nombre: "",
      carrera: "",
      tiempo_dedicacion: DEFAULT_DEDICATION,
      nivel_academico_actual: "",
      codigo_documento: "",
      periodo_plan: ""
    },
    diagnostico: {
      capacitacion_12_meses: "",
      avances_aplicados: "",
      comodidad_metodologias: "",
      estrategias_pedagogicas: "",
      herramientas_tecnologicas: "",
      formacion_adicional: "",
      tipo_formacion: ""
    },
    detalles_plan: {
      actividades_teoricas: [],
      actividades_practicas: [],
      impacto_esperado: "",
      vision_largo_plazo: ""
    },
    capacitaciones: [],
    estado: "ERROR",
    confianza: 0,
    campos_faltantes: [error?.message || "No se pudo procesar el archivo"],
    problemas_campos: {},
    advertencias: [],
    correccion_manual: false,
    fecha_correccion: ""
  };
}

async function processFiles(filePaths) {
  if (processing) throw new Error("Ya existe un procesamiento en curso.");
  const paths = uniquePdfPaths(filePaths);
  if (!paths.length) throw new Error("Selecciona al menos un archivo PDF.");
  processing = true;
  const engine = new PlanProcessingEngine({ maxPages: 20, maxOcrPages: 15, ocrScale: 2.55, aiThreshold: 4 });
  const records = [];

  try {
    for (let index = 0; index < paths.length; index += 1) {
      const filePath = paths[index];
      const current = index + 1;
      emitProgress({
        phase: "file-start",
        current,
        total: paths.length,
        percent: Math.round((index / paths.length) * 100),
        fileName: path.basename(filePath),
        message: `Leyendo ${current} de ${paths.length}`
      });

      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile() || stat.size === 0) throw new Error("El archivo está vacío o no está disponible.");
        const hash = hashFile(filePath);
        const result = await engine.process(filePath, {
          filePath,
          fileName: path.basename(filePath),
          hash,
          size: stat.size
        }, (detail) => {
          emitProgress({
            ...detail,
            current,
            total: paths.length,
            fileName: path.basename(filePath),
            overallPercent: Math.round((index / paths.length) * 100)
          });
        });
        records.push(result.record);
      } catch (error) {
        records.push(errorRecord(filePath, error));
      }

      emitProgress({
        phase: "file-complete",
        current,
        total: paths.length,
        percent: Math.round((current / paths.length) * 100),
        fileName: path.basename(filePath),
        message: `${current} de ${paths.length} procesados`
      });
    }

    const saved = storage.upsertMany(records);
    emitProgress({
      phase: "complete",
      current: paths.length,
      total: paths.length,
      percent: 100,
      message: saved.consolidated
        ? `Proceso finalizado · ${saved.consolidated} duplicados consolidados`
        : "Proceso finalizado"
    });
    return {
      ok: true,
      processed: records.length,
      saved,
      records: storage.list(),
      summary: storage.getSummary()
    };
  } finally {
    processing = false;
    await engine.close();
  }
}

function registerIpc() {
  ipcMain.handle("plans:select-files", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Seleccionar planes docentes",
      buttonLabel: "Agregar PDF",
      properties: ["openFile", "multiSelections", "dontAddToRecent"],
      filters: [{ name: "Archivos PDF", extensions: ["pdf"] }]
    });
    const filePaths = result.canceled ? [] : uniquePdfPaths(result.filePaths);
    return { canceled: result.canceled, filePaths, count: filePaths.length, limit: MAX_FILES };
  });

  ipcMain.handle("plans:select-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Seleccionar carpeta con planes docentes",
      buttonLabel: "Usar carpeta",
      properties: ["openDirectory", "dontAddToRecent"]
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, filePaths: [], count: 0, limit: MAX_FILES };
    const scan = scanFolder(result.filePaths[0]);
    return {
      canceled: false,
      folderPath: result.filePaths[0],
      filePaths: scan.files,
      count: scan.files.length,
      errors: scan.errors,
      truncated: scan.truncated,
      limit: MAX_FILES
    };
  });

  ipcMain.handle("plans:process", async (_event, payload) => processFiles(payload?.filePaths || []));
  ipcMain.handle("plans:list", async () => ({ ok: true, records: storage.list(), summary: storage.getSummary() }));
  ipcMain.handle("plans:update", async (_event, payload) => updatePlanRecord(payload || {}));

  ipcMain.handle("plans:export", async (_event, payload) => {
    const format = String(payload?.format || "xlsx").toLowerCase();
    const records = storage.list();
    if (!records.length) throw new Error("No existen registros para exportar.");
    const extension = format === "json" ? "json" : "xlsx";
    const result = await dialog.showSaveDialog(mainWindow, {
      title: format === "json" ? "Exportar JSON" : "Exportar Excel",
      defaultPath: `planes-docentes-${new Date().toISOString().slice(0, 10)}.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (format === "json") exportJson(records, result.filePath);
    else exportExcel(records, result.filePath);
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle("plans:open-data-folder", async () => {
    const error = await shell.openPath(storage.rootDir);
    if (error) throw new Error(error);
    return { ok: true, path: storage.rootDir };
  });

  ipcMain.handle("plans:open-file", async (_event, filePath) => {
    const resolved = path.resolve(String(filePath || ""));
    if (!fs.existsSync(resolved)) throw new Error("El archivo original ya no está disponible.");
    const error = await shell.openPath(resolved);
    if (error) throw new Error(error);
    return { ok: true };
  });

  ipcMain.handle("plans:clear", async () => {
    storage.clear();
    return { ok: true, records: [], summary: storage.getSummary() };
  });

  ipcMain.handle("app:info", async () => ({
    name: app.getName(),
    version: app.getVersion(),
    maxFiles: MAX_FILES,
    dataPath: storage.rootDir,
    localAi: {
      enabled: isLocalAiEnabled(),
      model: configuredModel()
    }
  }));
}

app.whenReady().then(() => {
  storage = new PlanStorage(path.join(app.getPath("userData"), "data"));
  migrateStoredRecords();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
