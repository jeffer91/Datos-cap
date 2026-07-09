/* =========================================================
Nombre completo: index.js
Ruta o ubicación: /plan-docente-extractor/src/exporters/index.js
Función o funciones:
- Centralizar los exportadores disponibles de la aplicación.
- Exportar Excel y JSON desde un solo punto de entrada.
- Validar que existan tablas antes de generar archivos.
- Devolver un resumen uniforme de archivos generados.
========================================================= */

"use strict";

const { exportTablesToExcel } = require("./excel.exporter");
const { exportTablesToJson } = require("./json.exporter");

function hasTables(tables) {
  if (!tables || typeof tables !== "object") {
    return false;
  }

  return Object.keys(tables).some((tableName) => {
    return Array.isArray(tables[tableName]);
  });
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
    outputDir: config.outputDir,
    baseName: config.baseName || "reporte_plan_individual",
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
