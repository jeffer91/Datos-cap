/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /main.js
Función o funciones:
- Abrir la página Documentos con menú superior y seis secciones.
- Procesar Planes, Acuerdos, Planificaciones, Informes Finales, Instrumentos de Evaluación e Informes de Impacto con lectura digital u OCR.
- Exponer consultas para la página Base independiente.
========================================================= */
"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const { validateOutputRequest } = require("./src/validators/document.validator");
const { validateDocumentSelection } = require("./src/validators/document-selection.validator");
const { processReport } = require("./src/processors/report.processor");
const { processAgreementReport } = require("./src/processors/acuerdo-patrocinio.processor");
const { processPlanningReport } = require("./src/processors/planificacion-capacitacion.processor");
const { processFinalReport } = require("./src/processors/informe-final-capacitacion.processor");
const {
  processEvaluationInstrumentReport,
  processImpactReport
} = require("./src/processors/seguimiento-capacitacion.processor");
const { createPersistenceService, createQueryService } = require("./src/database");

const APP_NAME = "Gestor de Documentos de Capacitación";
const DOCUMENT_TYPES = Object.freeze({
  "plan-individual": { label: "Planes Individuales de Formación y Capacitación", dialogTitle: "Seleccionar planes individuales en PDF" },
  "acuerdo-patrocinio": { label: "Acuerdos de Patrocinio Institucional", dialogTitle: "Seleccionar acuerdos de patrocinio en PDF" },
  "planificacion-capacitacion": { label: "Planificaciones de Capacitación", dialogTitle: "Seleccionar planificaciones de capacitación en PDF" },
  "informe-final-capacitacion": { label: "Informes Finales de Capacitación", dialogTitle: "Seleccionar informes finales de capacitación en PDF" },
  "instrumento-evaluacion": { label: "Instrumentos de Evaluación", dialogTitle: "Seleccionar instrumentos de evaluación en PDF" },
  "informe-impacto": { label: "Informes de Impacto", dialogTitle: "Seleccionar informes de impacto en PDF" }
});

let mainWindow = null;
let persistenceService = null;
let queryService = null;

function assertDocumentType(documentType) {
  const definition = DOCUMENT_TYPES[documentType];
  if (!definition) throw new Error(`Tipo documental no permitido: ${documentType || "vacío"}.`);
  return definition;
}
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 700,
    title: APP_NAME,
    backgroundColor: "#eef2f7",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "documentos", "documentos.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}
function createErrorResponse(error, fallbackMessage) {
  const message = error?.message || fallbackMessage;
  return { ok: false, message, files: {}, summary: {}, warnings: [], errors: [{ message }] };
}
function requirePersistence() {
  if (!persistenceService) throw new Error("La base local no está disponible. Reinicia la aplicación.");
  return persistenceService;
}
function requireQueryService() {
  if (!queryService) throw new Error("El servicio de consultas no está disponible. Reinicia la aplicación.");
  return queryService;
}
function emitOcrProgress(documentType, phase, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("ocr:progress", { documentType, phase, ...payload });
}
function createProgressCallbacks(documentType, phase) {
  return {
    onDocumentStart: (current, total, filePath) => emitOcrProgress(documentType, phase, {
      message: `Documento ${current} de ${total}: ${path.basename(filePath || "")}`,
      currentDocument: current,
      totalDocuments: total,
      percent: total ? Math.round(((current - 1) / total) * 100) : 0
    }),
    onModeChange: (data) => emitOcrProgress(documentType, phase, {
      message: `OCR activado: ${(data.reasons || []).join(" ")}`,
      mode: data.mode
    }),
    onPageRender: (page, totalPages) => emitOcrProgress(documentType, phase, {
      message: `Preparando página ${page} de ${totalPages || "?"}`,
      page,
      totalPages
    }),
    onPageStart: (page, totalPages) => emitOcrProgress(documentType, phase, {
      message: `Reconociendo página ${page} de ${totalPages || "?"}`,
      page,
      totalPages
    }),
    onOcrProgress: (message) => emitOcrProgress(documentType, phase, {
      message: message?.status ? `${message.status}${Number.isFinite(message.progress) ? ` ${Math.round(message.progress * 100)}%` : ""}` : "Reconociendo texto...",
      percent: Number.isFinite(message?.progress) ? Math.round(message.progress * 100) : undefined
    })
  };
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
  return { canceled: result.canceled, documentType, filePaths: result.canceled ? [] : (result.filePaths || []) };
}
async function chooseOutputDirectory() {
  if (!mainWindow) return { canceled: true, outputDir: "" };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Seleccionar carpeta de salida",
    buttonLabel: "Usar esta carpeta",
    properties: ["openDirectory", "createDirectory"]
  });
  return { canceled: result.canceled || !result.filePaths?.[0], outputDir: result.canceled ? "" : (result.filePaths?.[0] || "") };
}
async function generateDocumentReport(payload) {
  const config = payload || {};
  assertDocumentType(config.documentType);
  const requestCheck = validateOutputRequest(config);
  if (!requestCheck.ok) return { ok: false, message: requestCheck.issues.join(" "), files: {}, summary: {}, warnings: requestCheck.issues };

  const validation = await validateDocumentSelection(config.filePaths, config.documentType, createProgressCallbacks(config.documentType, "validation"));
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
    persistenceService: requirePersistence(),
    ...createProgressCallbacks(config.documentType, "processing")
  };
  if (config.documentType === "acuerdo-patrocinio") return processAgreementReport(processorOptions);
  if (config.documentType === "planificacion-capacitacion") return processPlanningReport(processorOptions);
  if (config.documentType === "informe-final-capacitacion") return processFinalReport(processorOptions);
  if (config.documentType === "instrumento-evaluacion") return processEvaluationInstrumentReport(processorOptions);
  if (config.documentType === "informe-impacto") return processImpactReport(processorOptions);
  return processReport(processorOptions);
}

function registerIpcHandlers() {
  ipcMain.handle("app:get-info", async () => ({
    appName: APP_NAME,
    version: app.getVersion(),
    platform: process.platform,
    databaseAvailable: Boolean(persistenceService),
    documentTypes: Object.keys(DOCUMENT_TYPES)
  }));
  ipcMain.handle("dialog:select-document-pdfs", async (_event, documentType) => selectPdfFiles(documentType));
  ipcMain.handle("files:validate-document-pdfs", async (_event, payload) => {
    const config = payload || {};
    assertDocumentType(config.documentType);
    return validateDocumentSelection(config.filePaths || [], config.documentType, createProgressCallbacks(config.documentType, "validation"));
  });
  ipcMain.handle("dialog:choose-output-dir", async () => chooseOutputDirectory());
  ipcMain.handle("reports:generate-document-report", async (_event, payload) => {
    try { return await generateDocumentReport(payload); }
    catch (error) {
      console.error("Error al generar reporte:", error);
      return createErrorResponse(error, "Error desconocido al generar el reporte.");
    }
  });
  ipcMain.handle("database:get-overview", async () => requireQueryService().getOverview());
  ipcMain.handle("database:query-documents", async (_event, options) => ({ ok: true, documents: requireQueryService().listDocuments(options || {}) }));
  ipcMain.handle("database:query-type-records", async (_event, payload) => {
    const config = payload || {};
    return { ok: true, ...requireQueryService().listTypeRecords(config.documentType, config.options || {}) };
  });
  ipcMain.handle("database:query-document-details", async (_event, documentId) => ({ ok: true, ...requireQueryService().getDocumentDetails(documentId) }));
  ipcMain.handle("database:query-runs", async (_event, options) => ({ ok: true, runs: requireQueryService().listProcessingRuns(options || {}) }));
  ipcMain.handle("database:open-folder", async () => {
    const databasePath = requirePersistence().getDatabasePath();
    const errorMessage = await shell.openPath(databasePath);
    if (errorMessage) throw new Error(errorMessage);
    return { ok: true, databasePath };
  });
}

app.whenReady().then(() => {
  persistenceService = createPersistenceService(path.join(app.getPath("userData"), "local-database"));
  queryService = createQueryService(persistenceService.database);
  registerIpcHandlers();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
