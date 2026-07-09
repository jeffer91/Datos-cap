/* =========================================================
Nombre completo: main.js
Ruta o ubicación: /plan-docente-extractor/main.js
Función o funciones:
- Crear la ventana principal de la aplicación Electron.
- Configurar seguridad básica: contextIsolation, preload y sin nodeIntegration.
- Permitir seleccionar múltiples archivos PDF desde el sistema.
- Validar existencia, extensión, tamaño y duplicados de los PDF seleccionados.
- Ejecutar el flujo completo: leer PDF, extraer campos, construir tablas y exportar Excel + JSON.
========================================================= */

"use strict";

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const { readPdfFiles } = require("./src/extractor/pdf.reader");
const { parsePdfDocuments } = require("./src/extractor/fields.parser");
const { buildAllTables, flattenValidationWarnings } = require("./src/tables");
const { exportTablesToExcel } = require("./src/exporters/excel.exporter");
const { exportTablesToJson } = require("./src/exporters/json.exporter");

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
    const normalized = path.resolve(info.path || ".").toLowerCase();

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

function ensureOutputDirectory(outputDir) {
  const cleanDir = normalizeFilePath(outputDir);

  if (!cleanDir) {
    throw new Error("Debes seleccionar una carpeta de salida.");
  }

  if (!fs.existsSync(cleanDir)) {
    fs.mkdirSync(cleanDir, { recursive: true });
  }

  const stat = fs.statSync(cleanDir);

  if (!stat.isDirectory()) {
    throw new Error("La salida seleccionada no es una carpeta válida.");
  }

  return cleanDir;
}

function createTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("") + "_" + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

function createReportBaseName() {
  return `reporte_plan_individual_${createTimestamp()}`;
}

async function generatePlanReport(payload) {
  const config = payload || {};
  const validation = validatePdfFiles(config.filePaths || []);
  const outputDir = ensureOutputDirectory(config.outputDir);

  if (!validation.canContinue) {
    return {
      ok: false,
      message: "No hay PDF válidos para procesar.",
      validation,
      files: {},
      summary: {}
    };
  }

  const validPaths = validation.validFiles.map((file) => file.path);
  const readResult = await readPdfFiles(validPaths);
  const parseResult = parsePdfDocuments(readResult.documents);
  const tableResult = buildAllTables(parseResult);
  const validationWarnings = flattenValidationWarnings(tableResult.validations);
  const baseName = createReportBaseName();

  const exportPayload = {
    outputDir,
    baseName,
    tables: tableResult.tables,
    summary: {
      ...tableResult.summary,
      pdf_seleccionados: validation.total,
      pdf_validos: validation.validCount,
      pdf_invalidos: validation.invalidCount,
      pdf_leidos: readResult.okCount,
      pdf_con_error_lectura: readResult.errorCount,
      pdf_parseados: parseResult.parsedCount,
      pdf_con_error_parseo: parseResult.errorCount
    },
    validations: tableResult.validations,
    warnings: validationWarnings,
    errors: [
      ...validation.invalidFiles.map((file) => ({
        archivo: file.name,
        errores: file.errors
      })),
      ...parseResult.errors
    ]
  };

  const excelResult = exportTablesToExcel(exportPayload);
  const jsonResult = exportTablesToJson(exportPayload);

  return {
    ok: true,
    message: "Reporte generado correctamente.",
    outputDir,
    files: {
      excel: excelResult,
      json: jsonResult
    },
    validation,
    readResult: {
      total: readResult.total,
      okCount: readResult.okCount,
      errorCount: readResult.errorCount
    },
    parseResult: {
      total: parseResult.total,
      parsedCount: parseResult.parsedCount,
      errorCount: parseResult.errorCount,
      errors: parseResult.errors
    },
    summary: exportPayload.summary,
    warnings: validationWarnings
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

ipcMain.handle("reports:generate-plan-report", async (_event, payload) => {
  try {
    return await generatePlanReport(payload);
  } catch (error) {
    return {
      ok: false,
      message: error.message || "Error desconocido al generar el reporte.",
      files: {},
      summary: {},
      warnings: [],
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
  }
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
