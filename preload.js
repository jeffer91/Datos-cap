/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /preload.js
Función o funciones:
- Exponer una API segura para Documentos, OCR, Base y Reporte Individual.
- Permitir escuchar progreso OCR sin exponer Node.js al renderer.
========================================================= */
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const INVOKE_CHANNELS = new Set([
  "app:get-info",
  "dialog:select-document-pdfs",
  "files:validate-document-pdfs",
  "dialog:choose-output-dir",
  "reports:generate-document-report",
  "database:get-overview",
  "database:query-documents",
  "database:query-type-records",
  "database:query-document-details",
  "database:query-runs",
  "database:open-folder",
  "reportes-individuales:listar-docentes",
  "reportes-individuales:consultar-docente",
  "reportes-individuales:preparar"
]);
const EVENT_CHANNELS = new Set(["ocr:progress"]);

function invoke(channel, payload) {
  if (!INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`Canal no permitido: ${channel}`));
  }
  return ipcRenderer.invoke(channel, payload);
}
function subscribe(channel, callback) {
  if (!EVENT_CHANNELS.has(channel) || typeof callback !== "function") return () => {};
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("documentAppAPI", {
  getAppInfo: () => invoke("app:get-info"),
  selectDocumentFiles: (documentType) => invoke("dialog:select-document-pdfs", documentType),
  validateDocumentFiles: (payload) => invoke("files:validate-document-pdfs", payload),
  chooseOutputDirectory: () => invoke("dialog:choose-output-dir"),
  generateDocumentReport: (payload) => invoke("reports:generate-document-report", payload),
  onOcrProgress: (callback) => subscribe("ocr:progress", callback),

  getDatabaseOverview: () => invoke("database:get-overview"),
  queryDatabaseDocuments: (options) => invoke("database:query-documents", options),
  queryDatabaseTypeRecords: (documentType, options) => invoke("database:query-type-records", { documentType, options }),
  queryDatabaseDocumentDetails: (documentId) => invoke("database:query-document-details", documentId),
  queryDatabaseRuns: (options) => invoke("database:query-runs", options),
  openDatabaseFolder: () => invoke("database:open-folder"),

  listIndividualReportTeachers: (options) => invoke("reportes-individuales:listar-docentes", options),
  getIndividualReport: (key) => invoke("reportes-individuales:consultar-docente", key),
  prepareIndividualReport: (key) => invoke("reportes-individuales:preparar", key)
});
