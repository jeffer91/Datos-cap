/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /main.js
Función o funciones:
- Administrar Planes Individuales y Acuerdos de Patrocinio en secciones independientes.
- Inicializar la base local, procesar documentos y exponer consultas seguras.
========================================================= */
"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { validateOutputRequest } = require("./src/validators/document.validator");
const { validateDocumentSelection } = require("./src/validators/document-selection.validator");
const { processReport } = require("./src/processors/report.processor");
const { processAgreementReport } = require("./src/processors/acuerdo-patrocinio.processor");
const { createPersistenceService } = require("./src/database");

const APP_NAME = "Gestor de Documentos de Capacitación";
const DOCUMENT_TYPES = Object.freeze({
  "plan-individual": {
    label: "Planes Individuales de Formación y Capacitación",
    dialogTitle: "Seleccionar planes individuales en PDF"
  },
  "acuerdo-patrocinio": {
    label: "Acuerdos de Patrocinio Institucional",
    dialogTitle: "Seleccionar acuerdos de patrocinio en PDF"
  }
});

let mainWindow = null;
let persistenceService = null;

function assertDocumentType(documentType) {
  const definition = DOCUMENT_TYPES[documentType];
  if (!definition) throw new Error(`Tipo documental no permitido: ${documentType || "vacío"}.`);
  return definition;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
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
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createErrorResponse(error, fallbackMessage) {
  const message = error?.message || fallbackMessage;
  return { ok: false, message, files: {}, summary: {}, warnings: [], errors: [{ message }] };
}

function requireDatabase() {
  if (!persistenceService) throw new Error("La base local no está disponible. Reinicia la aplicación.");
  return persistenceService;
}

async function selectPdfFiles(documentType) {
  const definition = assertDocumentType(documentType);
  if (!mainWindow) return { canceled: true, documentType, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: definition.dialogTitle,
    buttonLabel: "Cargar PDF",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Documentos PDF", extensions: ["pdf"] }]
  });
  return {
    canceled: result.canceled,
    documentType,
    filePaths: result.canceled ? [] : (result.filePaths || [])
  };
}

async function chooseOutputDirectory() {
  if (!mainWindow) return { canceled: true, outputDir: "" };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Seleccionar carpeta de salida",
    buttonLabel: "Usar esta carpeta",
    properties: ["openDirectory", "createDirectory"]
  });
  return {
    canceled: result.canceled || !result.filePaths?.[0],
    outputDir: result.canceled ? "" : (result.filePaths?.[0] || "")
  };
}

async function generateDocumentReport(payload) {
  const config = payload || {};
  assertDocumentType(config.documentType);
  const requestCheck = validateOutputRequest(config);
  if (!requestCheck.ok) {
    return { ok: false, message: requestCheck.issues.join(" "), files: {}, summary: {}, warnings: requestCheck.issues };
  }
  const validation = await validateDocumentSelection(config.filePaths, config.documentType);
  if (!validation.canContinue) {
    return {
      ok: false,
      message: "No hay PDF válidos para procesar en esta sección.",
      validation,
      files: {},
      summary: {},
      warnings: validation.invalidFiles.map((file) => ({ archivo: file.name, errores: file.errors }))
    };
  }
  const processorOptions = {
    outputDir: config.outputDir,
    validation,
    persistenceService: requireDatabase()
  };
  return config.documentType === "acuerdo-patrocinio"
    ? processAgreementReport(processorOptions)
    : processReport(processorOptions);
}

function registerIpcHandlers() {
  ipcMain.handle("app:get-info", async () => ({
    appName: APP_NAME,
    version: app.getVersion(),
    platform: process.platform,
    databaseAvailable: Boolean(persistenceService)
  }));
  ipcMain.handle("dialog:select-document-pdfs", async (_event, documentType) => selectPdfFiles(documentType));
  ipcMain.handle("files:validate-document-pdfs", async (_event, payload) => {
    const config = payload || {};
    assertDocumentType(config.documentType);
    return validateDocumentSelection(config.filePaths || [], config.documentType);
  });
  ipcMain.handle("dialog:choose-output-dir", async () => chooseOutputDirectory());
  ipcMain.handle("reports:generate-document-report", async (_event, payload) => {
    try { return await generateDocumentReport(payload); }
    catch (error) {
      console.error("Error al generar reporte:", error);
      return createErrorResponse(error, "Error desconocido al generar el reporte.");
    }
  });
  ipcMain.handle("database:get-summary", async () => requireDatabase().getSummary());
  ipcMain.handle("database:list-recent-runs", async (_event, options) => ({
    ok: true,
    runs: requireDatabase().listRecentRuns(options?.limit || 10)
  }));
  ipcMain.handle("database:list-recent-documents", async (_event, options) => ({
    ok: true,
    documents: requireDatabase().listRecentDocuments(options?.limit || 20)
  }));
  ipcMain.handle("database:open-folder", async () => {
    const databasePath = requireDatabase().getDatabasePath();
    const errorMessage = await shell.openPath(databasePath);
    if (errorMessage) throw new Error(errorMessage);
    return { ok: true, databasePath };
  });
}

app.whenReady().then(() => {
  persistenceService = createPersistenceService(path.join(app.getPath("userData"), "local-database"));
  registerIpcHandlers();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
