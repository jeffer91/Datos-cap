/* =========================================================
Nombre completo: preload.js
Ruta o ubicación: /preload.js
Función o funciones:
- Exponer una API segura para Documentos, OCR, Base, Reporte Individual e Informe de Cumplimiento.
- Mantener aislado el renderer de Node.js y limitar los canales IPC permitidos.
- Permitir buscar PDF dentro de carpetas y subcarpetas con rutas largas.
========================================================= */
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const INVOKE_CHANNELS = new Set([
  "app:get-info", "dialog:select-document-pdfs", "dialog:select-document-folder", "files:validate-document-pdfs", "dialog:choose-output-dir", "reports:generate-document-report",
  "database:get-overview", "database:query-documents", "database:query-type-records", "database:query-document-details", "database:query-runs", "database:open-folder",
  "reportes-individuales:listar-docentes", "reportes-individuales:consultar-docente", "reportes-individuales:preparar",
  "informe-cumplimiento:obtener-filtros", "informe-cumplimiento:consultar-resumen", "informe-cumplimiento:ejecutar-analisis", "informe-cumplimiento:refinar-ia", "informe-cumplimiento:preparar",
  "informe-cumplimiento:listar-guias", "informe-cumplimiento:guardar-guia", "informe-cumplimiento:restaurar-guia", "informe-cumplimiento:versiones-guia", "informe-cumplimiento:probar-guia", "informe-cumplimiento:generar-seccion",
  "informe-cumplimiento:configuracion-ia", "informe-cumplimiento:guardar-configuracion-ia", "informe-cumplimiento:probar-proveedor-ia", "informe-cumplimiento:probar-cadena-ia", "informe-cumplimiento:exportar"
]);
const EVENT_CHANNELS = new Set(["ocr:progress"]);

function invoke(channel, payload) {
  if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error(`Canal no permitido: ${channel}`));
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
  selectDocumentFolder: (documentType) => invoke("dialog:select-document-folder", documentType),
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
  prepareIndividualReport: (key) => invoke("reportes-individuales:preparar", key),
  getComplianceFilters: () => invoke("informe-cumplimiento:obtener-filtros"),
  getComplianceDashboard: (filters) => invoke("informe-cumplimiento:consultar-resumen", filters),
  runComplianceInternalAnalysis: (filters) => invoke("informe-cumplimiento:ejecutar-analisis", filters),
  refineComplianceWithAi: (filters) => invoke("informe-cumplimiento:refinar-ia", filters),
  prepareComplianceReport: (filters) => invoke("informe-cumplimiento:preparar", filters),
  listComplianceGuides: () => invoke("informe-cumplimiento:listar-guias"),
  saveComplianceGuide: (guide) => invoke("informe-cumplimiento:guardar-guia", guide),
  restoreComplianceGuide: (guideId) => invoke("informe-cumplimiento:restaurar-guia", guideId),
  listComplianceGuideVersions: (guideId) => invoke("informe-cumplimiento:versiones-guia", guideId),
  testComplianceGuide: (payload) => invoke("informe-cumplimiento:probar-guia", payload),
  generateComplianceSection: (payload) => invoke("informe-cumplimiento:generar-seccion", payload),
  getComplianceAiConfiguration: () => invoke("informe-cumplimiento:configuracion-ia"),
  saveComplianceAiConfiguration: (config) => invoke("informe-cumplimiento:guardar-configuracion-ia", config),
  testComplianceAiProvider: (role) => invoke("informe-cumplimiento:probar-proveedor-ia", role),
  testComplianceAiChain: () => invoke("informe-cumplimiento:probar-cadena-ia"),
  exportComplianceReport: (payload) => invoke("informe-cumplimiento:exportar", payload)
});