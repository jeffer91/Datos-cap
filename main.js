"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { HybridPdfReader } = require("./src/hybrid-pdf-reader");
const { parsePlanText } = require("./src/plan-parser");
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
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
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
      tiempo_dedicacion: "",
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
    capacitaciones: [],
    estado: "ERROR",
    confianza: 0,
    campos_faltantes: [error?.message || "No se pudo procesar el archivo"],
    advertencias: []
  };
}

async function processFiles(filePaths) {
  if (processing) throw new Error("Ya existe un procesamiento en curso.");
  const paths = uniquePdfPaths(filePaths);
  if (!paths.length) throw new Error("Selecciona al menos un archivo PDF.");
  processing = true;
  const reader = new HybridPdfReader({ maxOcrPages: 15, ocrScale: 2.15 });
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
        const reading = await reader.read(filePath, (detail) => {
          emitProgress({
            ...detail,
            current,
            total: paths.length,
            fileName: path.basename(filePath),
            overallPercent: Math.round((index / paths.length) * 100)
          });
        });
        const record = parsePlanText(reading.text, {
          filePath,
          fileName: path.basename(filePath),
          hash,
          size: stat.size,
          pages: reading.pages,
          method: reading.method,
          warnings: reading.warnings
        });
        records.push(record);
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
    emitProgress({ phase: "complete", current: paths.length, total: paths.length, percent: 100, message: "Proceso finalizado" });
    return {
      ok: true,
      processed: records.length,
      saved,
      records,
      summary: storage.getSummary()
    };
  } finally {
    processing = false;
    await reader.close().catch(() => {});
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
    dataPath: storage.rootDir
  }));
}

app.whenReady().then(() => {
  storage = new PlanStorage(path.join(app.getPath("userData"), "data"));
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
