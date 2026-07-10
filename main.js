/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /main.js
Función o funciones:
- Crear la ventana principal de la aplicación Electron.
- Seleccionar, validar, procesar, guardar y exportar documentos.
- Administrar resumen, historial y carpeta física de la base local.
- Exponer consultas por tipo, periodo, carrera, docente, curso y estado.
========================================================= */

"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");

const { validatePdfFiles, validateOutputRequest } = require("./src/validators/document.validator");
const { processDocument } = require("./src/core/document.processor");
const { listDocumentTypes, assertDocumentType } = require("./src/core/document-type.registry");
const { createPersistenceService, createQueryService } = require("./src/database");

let mainWindow = null;
let persistenceService = null;
let queryService = null;

const APP_NAME = "Gestor Documental de Capacitación";
const DEFAULT_DOCUMENT_TYPE = "plan-individual";

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1120,
    minHeight: 700,
    title: APP_NAME,
    backgroundColor: "#f4f6f9",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

function createErrorResponse(error, fallbackMessage) {
  const message = error && error.message ? error.message : fallbackMessage;
  return {
    ok: false,
    message,
    files: {},
    summary: {},
    warnings: [],
    errors: [{ message }]
  };
}

function initializeLocalDatabase() {
  const databaseDirectory = path.join(app.getPath("userData"), "local-database");
  persistenceService = createPersistenceService(databaseDirectory);
  queryService = createQueryService(persistenceService.database);
  return persistenceService.getSummary();
}

function requirePersistenceService() {
  if (!persistenceService) {
    throw new Error("La base local no está disponible. Reinicia la aplicación y revisa los permisos de la carpeta de usuario.");
  }
  return persistenceService;
}

function requireQueryService() {
  if (!queryService) {
    throw new Error("El servicio de consultas no está disponible porque la base local no pudo iniciarse.");
  }
  return queryService;
}

async function selectPdfFiles(documentType = DEFAULT_DOCUMENT_TYPE) {
  const definition = assertDocumentType(documentType);

  if (!mainWindow) {
    return { canceled: true, documentType: definition.id, filePaths: [] };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Seleccionar: ${definition.shortLabel}`,
    buttonLabel: definition.allowMultiple ? "Cargar PDF" : "Cargar documento",
    properties: definition.allowMultiple ? ["openFile", "multiSelections"] : ["openFile"],
    filters: [{ name: "Documentos PDF", extensions: ["pdf"] }]
  });

  return {
    canceled: result.canceled,
    documentType: definition.id,
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

  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { canceled: true, outputDir: "" };
  }

  return { canceled: false, outputDir: result.filePaths[0] };
}

async function validateDocumentFiles(payload) {
  const config = payload || {};
  const documentType = config.documentType || DEFAULT_DOCUMENT_TYPE;
  assertDocumentType(documentType);
  const validation = validatePdfFiles(config.filePaths || [], { documentType });
  return requirePersistenceService().enrichValidation(validation, documentType);
}

async function generateDocumentReport(payload) {
  const config = {
    ...(payload || {}),
    documentType: payload && payload.documentType ? payload.documentType : DEFAULT_DOCUMENT_TYPE
  };
  const requestCheck = validateOutputRequest(config);

  if (!requestCheck.ok) {
    return {
      ok: false,
      message: requestCheck.issues.join(" "),
      files: {},
      summary: {},
      warnings: requestCheck.issues,
      errors: []
    };
  }

  const validation = requirePersistenceService().enrichValidation(
    validatePdfFiles(config.filePaths || [], { documentType: config.documentType }),
    config.documentType
  );

  if (!validation.canContinue) {
    return {
      ok: false,
      message: "No hay PDF válidos para procesar.",
      validation,
      files: {},
      summary: {},
      warnings: validation.invalidFiles.map((file) => ({ archivo: file.name, errores: file.errors })),
      errors: []
    };
  }

  return processDocument({
    documentType: config.documentType,
    outputDir: config.outputDir,
    validation,
    persistenceService: requirePersistenceService()
  });
}

async function openDatabaseFolder() {
  const service = requirePersistenceService();
  const errorMessage = await shell.openPath(service.getDatabasePath());
  if (errorMessage) throw new Error(errorMessage);
  return { ok: true, databasePath: service.getDatabasePath() };
}

function registerIpcHandlers() {
  ipcMain.handle("app:get-info", async () => ({
    appName: APP_NAME,
    version: app.getVersion(),
    platform: process.platform,
    databaseAvailable: Boolean(persistenceService),
    queryServiceAvailable: Boolean(queryService)
  }));

  ipcMain.handle("document-types:list", async () => listDocumentTypes());
  ipcMain.handle("dialog:select-document-pdfs", async (_event, documentType) => {
    return selectPdfFiles(documentType || DEFAULT_DOCUMENT_TYPE);
  });
  ipcMain.handle("files:validate-document-pdfs", async (_event, payload) => validateDocumentFiles(payload));
  ipcMain.handle("dialog:choose-output-dir", async () => chooseOutputDirectory());
  ipcMain.handle("reports:generate-document-report", async (_event, payload) => {
    try {
      return await generateDocumentReport(payload);
    } catch (error) {
      console.error("Error al generar reporte documental:", error);
      return createErrorResponse(error, "Error desconocido al generar el reporte.");
    }
  });

  ipcMain.handle("database:get-summary", async () => {
    try {
      return requirePersistenceService().getSummary();
    } catch (error) {
      return createErrorResponse(error, "No se pudo consultar la base local.");
    }
  });
  ipcMain.handle("database:list-recent-runs", async (_event, options) => {
    try {
      return { ok: true, runs: requirePersistenceService().listRecentRuns(options || {}) };
    } catch (error) {
      return createErrorResponse(error, "No se pudo consultar el historial local.");
    }
  });
  ipcMain.handle("database:open-folder", async () => {
    try {
      return await openDatabaseFolder();
    } catch (error) {
      return createErrorResponse(error, "No se pudo abrir la carpeta de la base local.");
    }
  });
  ipcMain.handle("database:get-filter-options", async () => {
    try {
      return requireQueryService().getFilterOptions();
    } catch (error) {
      return createErrorResponse(error, "No se pudieron cargar las opciones de consulta.");
    }
  });
  ipcMain.handle("database:query-documents", async (_event, filters) => {
    try {
      return requireQueryService().queryDocuments(filters || {});
    } catch (error) {
      return createErrorResponse(error, "No se pudo ejecutar la consulta documental.");
    }
  });
  ipcMain.handle("database:get-document-detail", async (_event, payload) => {
    try {
      const config = payload || {};
      return requireQueryService().getDocumentDetail(config.documentId, config.options || {});
    } catch (error) {
      return createErrorResponse(error, "No se pudo recuperar el detalle del documento.");
    }
  });

  // Compatibilidad temporal con la interfaz anterior.
  ipcMain.handle("dialog:select-pdfs", async () => selectPdfFiles(DEFAULT_DOCUMENT_TYPE));
  ipcMain.handle("files:validate-pdfs", async (_event, filePaths) => {
    return validateDocumentFiles({ documentType: DEFAULT_DOCUMENT_TYPE, filePaths });
  });
  ipcMain.handle("reports:generate-plan-report", async (_event, payload) => {
    try {
      return await generateDocumentReport({ ...(payload || {}), documentType: DEFAULT_DOCUMENT_TYPE });
    } catch (error) {
      console.error("Error al generar reporte de Plan Individual:", error);
      return createErrorResponse(error, "Error desconocido al generar el reporte.");
    }
  });
}

app.whenReady().then(() => {
  try {
    initializeLocalDatabase();
  } catch (error) {
    persistenceService = null;
    queryService = null;
    console.error("No se pudo iniciar la base local:", error);
  }

  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
