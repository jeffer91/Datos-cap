/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /src/exporters/index.js
Función o funciones:
- Centralizar los exportadores disponibles de la aplicación.
- Exportar Excel y JSON desde un solo punto de entrada.
- Validar que existan tablas antes de generar archivos.
- Devolver un resumen uniforme para cualquier tipo documental.
========================================================= */

"use strict";

const { exportTablesToExcel } = require("./excel.exporter");
const { exportTablesToJson } = require("./json.exporter");

function hasTables(tables) {
  if (!tables || typeof tables !== "object") {
    return false;
  }

  return Object.keys(tables).some((tableName) => Array.isArray(tables[tableName]));
}

function assertExportOptions(options) {
  const config = options || {};

  if (!config.outputDir) {
    throw new Error("No se recibió carpeta de salida.");
  }

  if (!hasTables(config.tables)) {
    throw new Error("No se recibieron tablas válidas para exportar.");
  }

  return config;
}

function exportAll(options) {
  const config = assertExportOptions(options);
  const excel = exportTablesToExcel(config);
  const json = exportTablesToJson(config);

  return {
    ok: Boolean(excel.ok && json.ok),
    documentType: config.documentType || "",
    outputDir: config.outputDir,
    baseName: config.baseName || "reporte_documental",
    files: {
      excel,
      json
    }
  };
}

module.exports = {
  hasTables,
  assertExportOptions,
  exportAll,
  exportTablesToExcel,
  exportTablesToJson
};
