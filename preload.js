/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /preload.js
Función o funciones:
- Exponer una API segura para documentos y base local.
========================================================= */
"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const ALLOWED_CHANNELS = new Set([
  "app:get-info",
  "dialog:select-document-pdfs",
  "files:validate-document-pdfs",
  "dialog:choose-output-dir",
  "reports:generate-document-report",
  "database:get-summary",
  "database:list-recent-runs",
  "database:list-recent-documents",
  "database:open-folder"
]);
function invoke(channel, payload) {
  if (!ALLOWED_CHANNELS.has(channel)) return Promise.reject(new Error(`Canal no permitido: ${channel}`));
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("documentAppAPI", {
  getAppInfo: () => invoke("app:get-info"),
  selectDocumentFiles: (documentType) => invoke("dialog:select-document-pdfs", documentType),
  validateDocumentFiles: (payload) => invoke("files:validate-document-pdfs", payload),
  chooseOutputDirectory: () => invoke("dialog:choose-output-dir"),
  generateDocumentReport: (payload) => invoke("reports:generate-document-report", payload),
  getDatabaseSummary: () => invoke("database:get-summary"),
  listRecentDatabaseRuns: (options) => invoke("database:list-recent-runs", options),
  listRecentDocuments: (options) => invoke("database:list-recent-documents", options),
  openDatabaseFolder: () => invoke("database:open-folder")
});
