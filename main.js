/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /plan-docente-extractor/main.js
Función o funciones:
- Crear la ventana principal de la aplicación Electron.
- Configurar seguridad básica: contextIsolation, preload y sin nodeIntegration.
- Permitir seleccionar múltiples archivos PDF desde el sistema.
- Validar existencia, extensión, tamaño y duplicados de los PDF seleccionados.
- Preparar la comunicación IPC entre la interfaz y el proceso principal.
========================================================= */

"use strict";

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;

const APP_NAME = "Plan Docente Extractor";
const VALID_EXTENSIONS = new Set([".pdf"]);

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: APP_NAME,
    backgroundColor: "#f4f6f9",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function normalizeFilePath(filePath) {
  return String(filePath || "").trim();
}

function getFileInfo(filePath) {
  const cleanPath = normalizeFilePath(filePath);
  const extension = path.extname(cleanPath).toLowerCase();
  const fileName = path.basename(cleanPath);

  const baseInfo = {
    path: cleanPath,
    name: fileName,
    extension,
    sizeBytes: 0,
    sizeMB: 0,
    exists: false,
    isPdf: extension === ".pdf",
    valid: false,
    duplicate: false,
    errors: []
  };

  if (!cleanPath) {
    baseInfo.errors.push("Ruta vacía.");
    return baseInfo;
  }

  if (!fs.existsSync(cleanPath)) {
    baseInfo.errors.push("El archivo no existe.");
    return baseInfo;
  }

  let stat = null;

  try {
    stat = fs.statSync(cleanPath);
  } catch (error) {
    baseInfo.errors.push("No se pudo leer la información del archivo.");
    return baseInfo;
  }

  baseInfo.exists = true;
  baseInfo.sizeBytes = stat.size;
  baseInfo.sizeMB = Number((stat.size / 1024 / 1024).toFixed(2));

  if (!stat.isFile()) {
    baseInfo.errors.push("La ruta no corresponde a un archivo.");
  }

  if (!VALID_EXTENSIONS.has(extension)) {
    baseInfo.errors.push("Solo se permiten archivos PDF.");
  }

  if (stat.size <= 0) {
    baseInfo.errors.push("El archivo está vacío.");
  }

  baseInfo.valid = baseInfo.errors.length === 0;

  return baseInfo;
}

function validatePdfFiles(filePaths) {
  const receivedPaths = Array.isArray(filePaths) ? filePaths : [];
  const seen = new Set();

  const files = receivedPaths.map((item) => {
    const info = getFileInfo(item);
    const normalized = path.resolve(info.path).toLowerCase();

    if (seen.has(normalized)) {
      info.duplicate = true;
      info.valid = false;
      info.errors.push("Archivo duplicado en la selección.");
    } else {
      seen.add(normalized);
    }

    return info;
  });

  const validFiles = files.filter((file) => file.valid);
  const invalidFiles = files.filter((file) => !file.valid);

  return {
    total: files.length,
    validCount: validFiles.length,
    invalidCount: invalidFiles.length,
    files,
    validFiles,
    invalidFiles,
    canContinue: validFiles.length > 0
  };
}

ipcMain.handle("app:get-info", async () => {
  return {
    appName: APP_NAME,
    version: app.getVersion(),
    platform: process.platform
  };
});

ipcMain.handle("dialog:select-pdfs", async () => {
  if (!mainWindow) {
    return {
      canceled: true,
      filePaths: []
    };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Seleccionar planes individuales en PDF",
    buttonLabel: "Cargar PDF",
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Documentos PDF",
        extensions: ["pdf"]
      }
    ]
  });

  if (result.canceled) {
    return {
      canceled: true,
      filePaths: []
    };
  }

  return {
    canceled: false,
    filePaths: result.filePaths || []
  };
});

ipcMain.handle("files:validate-pdfs", async (_event, filePaths) => {
  return validatePdfFiles(filePaths);
});

ipcMain.handle("dialog:choose-output-dir", async () => {
  if (!mainWindow) {
    return {
      canceled: true,
      outputDir: ""
    };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Seleccionar carpeta de salida",
    buttonLabel: "Usar esta carpeta",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return {
      canceled: true,
      outputDir: ""
    };
  }

  return {
    canceled: false,
    outputDir: result.filePaths[0]
  };
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
