/* =========================================================
Nombre completo: json.exporter.js
Ruta o ubicación: /plan-docente-extractor/src/exporters/json.exporter.js
Función o funciones:
- Generar archivo JSON con las cinco tablas no relacionales.
- Incluir metadatos de generación, resumen y validaciones.
- Guardar una estructura lista para futura base de datos.
- Mantener formato legible para revisión manual.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");

function ensureDirectory(directoryPath) {
  const cleanPath = String(directoryPath || "").trim();

  if (!cleanPath) {
    throw new Error("No se recibió carpeta de salida para generar el JSON.");
  }

  if (!fs.existsSync(cleanPath)) {
    fs.mkdirSync(cleanPath, { recursive: true });
  }

  const stat = fs.statSync(cleanPath);

  if (!stat.isDirectory()) {
    throw new Error("La ruta de salida no corresponde a una carpeta válida.");
  }
}

function sanitizeFileName(value) {
  return String(value || "reporte_plan_individual")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "reporte_plan_individual";
}

function createJsonPayload(options) {
  const config = options || {};
  const now = new Date();

  return {
    metadata: {
      generado_en: now.toISOString(),
      generado_por: "Plan Docente Extractor",
      version_estructura: "1.0.0",
      tipo_salida: "excel_json",
      observacion: "Estructura no relacional lista para revisión y futura carga a base de datos."
    },
    resumen: config.summary || {},
    validaciones: config.validations || {},
    advertencias: Array.isArray(config.warnings) ? config.warnings : [],
    errores: Array.isArray(config.errors) ? config.errors : [],
    tablas: config.tables || {}
  };
}

function exportTablesToJson(options) {
  const config = options || {};
  const outputDir = config.outputDir;
  const baseName = sanitizeFileName(config.baseName || "reporte_plan_individual");
  const filePath = path.join(outputDir, `${baseName}.json`);
  const payload = createJsonPayload(config);

  ensureDirectory(outputDir);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");

  return {
    ok: true,
    filePath,
    fileName: path.basename(filePath),
    tableCount: payload.tablas ? Object.keys(payload.tablas).length : 0,
    generatedAt: payload.metadata.generado_en
  };
}

module.exports = {
  ensureDirectory,
  sanitizeFileName,
  createJsonPayload,
  exportTablesToJson
};
