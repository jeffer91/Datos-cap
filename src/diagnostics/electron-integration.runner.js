/* =========================================================
Nombre completo: electron-integration.runner.js
Ruta o ubicación: /src/diagnostics/electron-integration.runner.js
Función o funciones:
- Abrir la interfaz real de Electron en modo de prueba.
- Generar y procesar ocho archivos PDF mediante botones, preload e IPC.
- Comprobar lectura digital, OCR, persistencia, consultas, exportación y respaldo.
- Guardar reporte, capturas y artefactos para auditoría de GitHub Actions.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  app,
  BrowserWindow,
  ipcMain
} = require("electron");

const { generateFixtureSet, ensureDirectory } = require("./pdf-fixture.generator");
const { validatePdfFiles, validateOutputRequest } = require("../validators/document.validator");
const { processDocument } = require("../core/document.processor");
const { listDocumentTypes } = require("../core/document-type.registry");
const { readPdfFile } = require("../extractor/pdf.reader");
const {
  createPersistenceService,
  createQueryService,
  createBackupService
} = require("../database");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-dev-shm-usage");

const TEST_TIMEOUT_MS = 10 * 60 * 1000;
const artifactRoot = path.resolve(
  process.env.INTEGRATION_ARTIFACT_DIR ||
  fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-electron-integration-"))
);
const fixtureDirectory = ensureDirectory(path.join(artifactRoot, "fixtures"));
const outputDirectory = ensureDirectory(path.join(artifactRoot, "exports"));
const screenshotDirectory = ensureDirectory(path.join(artifactRoot, "screenshots"));
const userDataDirectory = ensureDirectory(path.join(artifactRoot, "electron-user-data"));
const databaseDirectory = ensureDirectory(path.join(userDataDirectory, "local-database"));

app.setPath("userData", userDataDirectory);

let persistenceService = null;
let queryService = null;
let backupService = null;
let fixtures = [];
let fixtureByType = new Map();
let integrationWindow = null;
let processingResults = [];
let rendererMessages = [];

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
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

function initializeServices() {
  persistenceService = createPersistenceService(databaseDirectory);
  queryService = createQueryService(persistenceService.database);
  backupService = createBackupService(persistenceService.database, {
    appVersion: app.getVersion(),
    backupDirectory: path.join(databaseDirectory, "backups"),
    defaultRetention: 20
  });
}

function validatePayload(payload) {
  const config = payload || {};
  const validation = validatePdfFiles(config.filePaths || [], {
    documentType: config.documentType
  });
  return persistenceService.enrichValidation(validation, config.documentType);
}

async function generateReport(payload) {
  const config = payload || {};
  const requestCheck = validateOutputRequest(config);
  if (!requestCheck.ok) {
    return createErrorResponse(new Error(requestCheck.issues.join(" ")), "Solicitud inválida.");
  }

  const validation = validatePayload(config);
  if (!validation.canContinue) {
    return {
      ok: false,
      message: "No hay PDF válidos para procesar.",
      validation,
      files: {},
      summary: {},
      warnings: [],
      errors: []
    };
  }

  const result = await processDocument({
    documentType: config.documentType,
    outputDir: config.outputDir,
    validation,
    persistenceService
  });

  if (result && result.ok) {
    result.backup = backupService.createAutomaticBackup(`integracion-${config.documentType}`);
  }
  processingResults.push({ documentType: config.documentType, result });
  return result;
}

function registerIntegrationHandlers() {
  ipcMain.handle("app:get-info", async () => ({
    appName: "Gestor Documental de Capacitación",
    version: app.getVersion(),
    platform: process.platform,
    integrationMode: true,
    databaseAvailable: true,
    queryServiceAvailable: true,
    backupServiceAvailable: true
  }));

  ipcMain.handle("document-types:list", async () => listDocumentTypes());
  ipcMain.handle("dialog:select-document-pdfs", async (_event, documentType) => {
    const fixture = fixtureByType.get(documentType);
    return fixture
      ? { canceled: false, documentType, filePaths: [fixture.filePath] }
      : { canceled: true, documentType, filePaths: [] };
  });
  ipcMain.handle("files:validate-document-pdfs", async (_event, payload) => validatePayload(payload));
  ipcMain.handle("dialog:choose-output-dir", async () => ({ canceled: false, outputDir: outputDirectory }));
  ipcMain.handle("reports:generate-document-report", async (_event, payload) => {
    try {
      return await generateReport(payload);
    } catch (error) {
      return createErrorResponse(error, "Falló el procesamiento integral.");
    }
  });

  ipcMain.handle("database:get-summary", async () => persistenceService.getSummary());
  ipcMain.handle("database:list-recent-runs", async (_event, options) => ({
    ok: true,
    runs: persistenceService.listRecentRuns(options || {})
  }));
  ipcMain.handle("database:open-folder", async () => ({ ok: true, databasePath: databaseDirectory }));
  ipcMain.handle("database:get-filter-options", async () => queryService.getFilterOptions());
  ipcMain.handle("database:query-documents", async (_event, filters) => queryService.queryDocuments(filters || {}));
  ipcMain.handle("database:get-document-detail", async (_event, payload) => {
    const config = payload || {};
    return queryService.getDocumentDetail(config.documentId, config.options || {});
  });

  ipcMain.handle("backup:get-summary", async () => backupService.getSummary());
  ipcMain.handle("backup:create-manual", async () => ({ canceled: true }));
  ipcMain.handle("backup:restore", async () => ({ canceled: true }));
  ipcMain.handle("backup:open-folder", async () => ({ ok: true, backupDirectory: backupService.backupDirectory }));
}

function waitForWindowReady(window) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("La interfaz no terminó de cargar dentro del tiempo esperado.")), 60000);
    window.webContents.once("did-finish-load", () => {
      clearTimeout(timeout);
      resolve();
    });
    window.webContents.once("did-fail-load", (_event, errorCode, errorDescription) => {
      clearTimeout(timeout);
      reject(new Error(`La interfaz no pudo cargarse: ${errorCode} ${errorDescription}`));
    });
  });
}

async function createIntegrationWindow() {
  integrationWindow = new BrowserWindow({
    width: 1440,
    height: 1000,
    show: false,
    backgroundColor: "#f4f6f9",
    webPreferences: {
      preload: path.resolve(__dirname, "..", "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  integrationWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    rendererMessages.push({ level, message, line, sourceId });
  });
  integrationWindow.webContents.on("render-process-gone", (_event, details) => {
    rendererMessages.push({ level: 3, message: `render-process-gone: ${JSON.stringify(details)}` });
  });

  const ready = waitForWindowReady(integrationWindow);
  await integrationWindow.loadFile(path.resolve(__dirname, "..", "..", "renderer", "index.html"));
  await ready;
  integrationWindow.webContents.setZoomFactor(0.8);
  return integrationWindow;
}

function buildRendererFlowScript(documentTypes) {
  const typesJson = JSON.stringify(documentTypes);
  return `(async () => {
    const documentTypes = ${typesJson};
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitFor = async (predicate, label, timeout = ${TEST_TIMEOUT_MS}) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        try {
          if (predicate()) return true;
        } catch (_error) { }
        await sleep(120);
      }
      throw new Error("Tiempo agotado esperando: " + label);
    };

    await waitFor(
      () => document.querySelectorAll("[data-document-type]").length === documentTypes.length,
      "ocho apartados en el menú",
      60000
    );

    const results = [];
    for (const documentType of documentTypes) {
      const section = document.querySelector('[data-document-type="' + documentType + '"]');
      if (!section) throw new Error("No existe el apartado " + documentType);
      section.click();
      await waitFor(() => section.classList.contains("is-active"), "selección de " + documentType, 15000);

      document.getElementById("btnSelectPdf").click();
      await waitFor(
        () => document.getElementById("totalFiles").textContent.trim() === "1",
        "selección PDF de " + documentType,
        30000
      );

      document.getElementById("btnValidate").click();
      await waitFor(
        () => document.getElementById("statusBox").textContent.includes("Validación completada") ||
          document.getElementById("statusBox").classList.contains("status-danger"),
        "validación de " + documentType,
        60000
      );

      if (document.getElementById("validFiles").textContent.trim() !== "1") {
        throw new Error("El PDF de " + documentType + " no quedó válido: " + document.getElementById("statusBox").textContent);
      }

      document.getElementById("btnChooseOutput").click();
      await waitFor(
        () => document.getElementById("outputBox").classList.contains("status-success"),
        "carpeta de salida de " + documentType,
        30000
      );
      await waitFor(
        () => !document.getElementById("btnGenerate").disabled,
        "botón generar de " + documentType,
        30000
      );

      document.getElementById("btnGenerate").click();
      await waitFor(
        () => document.getElementById("resultsContainer").textContent.includes("Reporte generado correctamente") ||
          document.getElementById("statusBox").classList.contains("status-danger"),
        "procesamiento de " + documentType
      );

      const success = document.getElementById("resultsContainer").textContent.includes("Reporte generado correctamente");
      results.push({
        documentType,
        success,
        title: document.getElementById("pageTitle").textContent.trim(),
        status: document.getElementById("statusBox").textContent.trim(),
        outputStatus: document.getElementById("outputBox").textContent.trim(),
        selected: document.getElementById("totalFiles").textContent.trim(),
        valid: document.getElementById("validFiles").textContent.trim(),
        tableCount: document.querySelectorAll("#expectedTables .expected-table").length
      });

      if (!success) throw new Error("La interfaz falló en " + documentType + ": " + results.at(-1).status);
      await sleep(300);
    }

    return {
      apiAvailable: Boolean(window.documentAppAPI),
      menuCount: document.querySelectorAll("[data-document-type]").length,
      results,
      databaseStatus: document.getElementById("databaseStatus").textContent.trim(),
      backupStatus: document.getElementById("backupStatus").textContent.trim(),
      queryStatus: document.getElementById("queryStatus").textContent.trim()
    };
  })()`;
}

async function captureScreenshot(index, documentType) {
  const image = await integrationWindow.webContents.capturePage();
  const filePath = path.join(
    screenshotDirectory,
    `${String(index + 1).padStart(2, "0")}-${documentType}.png`
  );
  await fs.promises.writeFile(filePath, image.toPNG());
  return filePath;
}

async function runRendererFlow() {
  const documentTypes = listDocumentTypes().map((definition) => definition.id);
  const flowPromise = integrationWindow.webContents.executeJavaScript(buildRendererFlowScript(documentTypes), true);

  let capturedCount = 0;
  const captureTimer = setInterval(async () => {
    try {
      while (capturedCount < processingResults.length) {
        const current = processingResults[capturedCount];
        await captureScreenshot(capturedCount, current.documentType);
        capturedCount += 1;
      }
    } catch (_error) {
      // La captura es evidencia adicional y no debe detener el procesamiento principal.
    }
  }, 500);

  try {
    const result = await flowPromise;
    while (capturedCount < processingResults.length) {
      const current = processingResults[capturedCount];
      await captureScreenshot(capturedCount, current.documentType);
      capturedCount += 1;
    }
    return result;
  } finally {
    clearInterval(captureTimer);
  }
}

async function inspectFixtures() {
  const inspections = [];
  for (const fixture of fixtures) {
    const header = await fs.promises.readFile(fixture.filePath, { encoding: null });
    assertCondition(header.subarray(0, 4).toString("ascii") === "%PDF", `${fixture.fileName} no es un PDF real.`);
    const digital = await readPdfFile(fixture.filePath, 0);
    inspections.push({
      documentType: fixture.documentType,
      mode: fixture.mode,
      fileName: fixture.fileName,
      sizeBytes: fixture.sizeBytes,
      digitalTextLength: String(digital.text || "").trim().length,
      digitalReadOk: digital.ok
    });
  }
  return inspections;
}

function validateIntegration(uiResult, fixtureInspections) {
  const documentTypes = listDocumentTypes().map((definition) => definition.id);
  assertCondition(uiResult.apiAvailable, "El preload no expuso documentAppAPI.");
  assertCondition(uiResult.menuCount === 8, "La interfaz no mostró ocho apartados.");
  assertCondition(uiResult.results.length === 8, "La interfaz no completó ocho flujos.");
  assertCondition(uiResult.results.every((item) => item.success), "Algún apartado no terminó correctamente desde la interfaz.");
  assertCondition(processingResults.length === 8, "El proceso principal no recibió ocho solicitudes.");

  documentTypes.forEach((documentType) => {
    const entry = processingResults.find((item) => item.documentType === documentType);
    assertCondition(entry && entry.result && entry.result.ok, `El procesador ${documentType} no devolvió ok=true.`);
    assertCondition(fs.existsSync(entry.result.files.excel.filePath), `No existe el Excel de ${documentType}.`);
    assertCondition(fs.existsSync(entry.result.files.json.filePath), `No existe el JSON de ${documentType}.`);
    assertCondition(entry.result.database && entry.result.database.rowsSaved > 0, `No se guardaron filas de ${documentType}.`);
    assertCondition(entry.result.backup && entry.result.backup.ok, `No se creó respaldo automático para ${documentType}.`);
  });

  const ocrResult = processingResults.find((item) => item.documentType === "acuerdo-patrocinio");
  assertCondition(ocrResult.result.readResult.ocrCount >= 1, "El PDF escaneado no activó OCR.");
  assertCondition(ocrResult.result.readResult.digitalCount === 0, "El PDF escaneado fue clasificado incorrectamente como digital.");

  const scannedInspection = fixtureInspections.find((item) => item.documentType === "acuerdo-patrocinio");
  assertCondition(scannedInspection.digitalTextLength < 80, "El fixture escaneado contiene una capa de texto significativa.");

  const summary = persistenceService.getSummary();
  const query = queryService.queryDocuments({ pageSize: 100 });
  const backups = backupService.getSummary();
  assertCondition(summary.documentCount === 8, `La base contiene ${summary.documentCount} documentos y se esperaban 8.`);
  assertCondition(summary.activeDocumentCount === 8, "Los ocho documentos deben permanecer activos.");
  assertCondition(summary.tableRows > 8, "La base no contiene suficientes filas documentales.");
  assertCondition(query.pagination.total === 8, "La consulta integral no recuperó ocho documentos.");
  assertCondition(backups.automaticBackupCount >= 8, "No se conservaron los respaldos automáticos de los ocho procesos.");

  const seriousRendererMessages = rendererMessages.filter((message) => Number(message.level) >= 3);
  assertCondition(seriousRendererMessages.length === 0, `La interfaz registró errores: ${JSON.stringify(seriousRendererMessages)}`);

  return { summary, query, backups, seriousRendererMessages };
}

async function writeReport(payload) {
  const reportPath = path.join(artifactRoot, "electron-integration-report.json");
  await fs.promises.writeFile(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return reportPath;
}

async function runIntegrationTest() {
  fixtures = await generateFixtureSet(fixtureDirectory);
  fixtureByType = new Map(fixtures.map((fixture) => [fixture.documentType, fixture]));
  assertCondition(fixtures.length === 8, "No se generaron los ocho PDF de integración.");

  initializeServices();
  registerIntegrationHandlers();
  await createIntegrationWindow();

  const fixtureInspections = await inspectFixtures();
  const uiResult = await runRendererFlow();
  const validations = validateIntegration(uiResult, fixtureInspections);
  const report = {
    ok: true,
    executedAt: new Date().toISOString(),
    artifactRoot,
    fixtures,
    fixtureInspections,
    ui: uiResult,
    processing: processingResults.map((entry) => ({
      documentType: entry.documentType,
      ok: entry.result.ok,
      readResult: entry.result.readResult,
      summary: entry.result.summary,
      files: entry.result.files,
      database: {
        documentsSaved: entry.result.database.documentsSaved,
        rowsSaved: entry.result.database.rowsSaved,
        duplicateDocumentsSkipped: entry.result.database.duplicateDocumentsSkipped
      },
      backup: entry.result.backup
    })),
    database: validations.summary,
    query: validations.query.pagination,
    backups: validations.backups,
    rendererMessages
  };
  report.reportPath = await writeReport(report);
  return report;
}

app.whenReady().then(async () => {
  try {
    const result = await runIntegrationTest();
    console.log("ELECTRON_INTEGRATION_OK");
    console.log(JSON.stringify({
      ok: result.ok,
      reportPath: result.reportPath,
      artifactRoot: result.artifactRoot,
      documents: result.database.documentCount,
      rows: result.database.tableRows,
      backups: result.backups.automaticBackupCount,
      ocrCount: result.processing.find((item) => item.documentType === "acuerdo-patrocinio").readResult.ocrCount
    }, null, 2));
    if (integrationWindow && !integrationWindow.isDestroyed()) integrationWindow.destroy();
    app.exit(0);
  } catch (error) {
    console.error("ELECTRON_INTEGRATION_ERROR");
    console.error(error.stack || error.message);
    try {
      await writeReport({
        ok: false,
        executedAt: new Date().toISOString(),
        artifactRoot,
        fixtures,
        processingResults,
        rendererMessages,
        error: { message: error.message, stack: error.stack }
      });
    } catch (_reportError) { /* Sin acción. */ }
    if (integrationWindow && !integrationWindow.isDestroyed()) integrationWindow.destroy();
    app.exit(1);
  }
});

app.on("window-all-closed", () => {
  // El runner controla el cierre explícitamente después de escribir el reporte.
});
