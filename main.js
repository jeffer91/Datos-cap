/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /plan-docente-extractor/main.js
Función o funciones:
- Crear la ventana principal de la aplicación Electron.
- Configurar seguridad básica: contextIsolation, preload y sin nodeIntegration.
- Permitir seleccionar múltiples archivos PDF desde el sistema.
- Validar documentos usando el validador central.
- Ejecutar la generación del reporte usando el procesador central.
========================================================= */

"use strict";

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

const { validatePdfFiles, validateOutputRequest } = require("./src/validators/document.validator");
const { processReport } = require("./src/processors/report.processor");

let mainWindow = null;

const APP_NAME = "Plan Docente Extractor";

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

function createErrorResponse(error, fallbackMessage) {
  return {
    ok: false,
    message: error && error.message ? error.message : fallbackMessage,
    files: {},
    summary: {},
    warnings: [],
    error: {
      name: error && error.name ? error.name : "Error",
      message: error && error.message ? error.message : fallbackMessage,
      stack: error && error.stack ? error.stack : ""
    }
  };
}

async function selectPdfFiles() {
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
}

async function chooseOutputDirectory() {
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
}

async function generatePlanReport(payload) {
  const requestCheck = validateOutputRequest(payload);

  if (!requestCheck.ok) {
    return {
      ok: false,
      message: requestCheck.issues.join(" "),
      files: {},
      summary: {},
      warnings: requestCheck.issues
    };
  }

  const validation = validatePdfFiles(payload.filePaths || []);

  if (!validation.canContinue) {
    return {
      ok: false,
      message: "No hay PDF válidos para procesar.",
      validation,
      files: {},
      summary: {},
      warnings: validation.invalidFiles.map((file) => ({
        archivo: file.name,
        errores: file.errors
      }))
    };
  }

  return processReport({
    outputDir: payload.outputDir,
    validation
  });
}

function registerIpcHandlers() {
  ipcMain.handle("app:get-info", async () => {
    return {
      appName: APP_NAME,
      version: app.getVersion(),
      platform: process.platform
    };
  });

  ipcMain.handle("dialog:select-pdfs", async () => {
    return selectPdfFiles();
  });

  ipcMain.handle("files:validate-pdfs", async (_event, filePaths) => {
    return validatePdfFiles(filePaths);
  });

  ipcMain.handle("dialog:choose-output-dir", async () => {
    return chooseOutputDirectory();
  });

  ipcMain.handle("reports:generate-plan-report", async (_event, payload) => {
    try {
      return await generatePlanReport(payload);
    } catch (error) {
      return createErrorResponse(error, "Error desconocido al generar el reporte.");
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
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
