const fs = require('fs');
const path = require('path');

const { writeJson, ensureDir } = require('../../services/fileService');
const { getStoragePaths } = require('../../services/pathService');
const { logInfo, logError } = require('../../services/loggerService');
const {
  REQUIRED_DIRECTORIES,
  buildStartupChecklist
} = require('./startupChecklist');

function getProjectRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function ensureRequiredDirectories() {
  const projectRoot = getProjectRoot();
  const results = [];

  REQUIRED_DIRECTORIES.forEach((relativePath) => {
    const absolutePath = path.join(projectRoot, relativePath);

    try {
      ensureDir(absolutePath);
      results.push({
        ok: true,
        path: relativePath,
        absolutePath,
        message: 'Carpeta verificada.'
      });
    } catch (error) {
      results.push({
        ok: false,
        path: relativePath,
        absolutePath,
        message: error.message
      });
    }
  });

  return {
    ok: results.every((item) => item.ok),
    results
  };
}

function writeStartupReport(report) {
  const storagePaths = getStoragePaths();
  ensureDir(storagePaths.logs);

  const reportPath = path.join(storagePaths.logs, 'startup_stability_report.json');
  writeJson(reportPath, report);

  return reportPath;
}

function runStartupRepair() {
  try {
    const before = buildStartupChecklist();
    const directories = ensureRequiredDirectories();
    const after = buildStartupChecklist();

    const report = {
      ok: after.ok,
      generatedAt: new Date().toISOString(),
      before,
      repair: {
        directories
      },
      after,
      recommendations: buildStartupRecommendations(after)
    };

    const reportPath = writeStartupReport(report);

    logInfo('Reparación de arranque ejecutada', {
      ok: report.ok,
      reportPath
    });

    return {
      ...report,
      reportPath
    };
  } catch (error) {
    logError('Error al ejecutar reparación de arranque', error);

    return {
      ok: false,
      message: 'No se pudo ejecutar la reparación de arranque.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function runStartupDiagnostic() {
  try {
    const checklist = buildStartupChecklist();
    const report = {
      ok: checklist.ok,
      generatedAt: new Date().toISOString(),
      checklist,
      recommendations: buildStartupRecommendations(checklist)
    };

    const reportPath = writeStartupReport(report);

    return {
      ...report,
      reportPath
    };
  } catch (error) {
    return {
      ok: false,
      message: 'No se pudo ejecutar diagnóstico de arranque.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function buildStartupRecommendations(checklist) {
  const recommendations = [];

  const missingProjectFiles = checklist.projectFiles.items.filter((item) => !item.exists);
  const missingModuleFiles = checklist.moduleFiles.items.filter((item) => !item.exists);
  const missingDirectories = checklist.directories.items.filter((item) => !item.exists || !item.isDirectory);

  if (missingProjectFiles.length) {
    recommendations.push('Revisar archivos base faltantes del proyecto antes de iniciar Electron.');
  }

  if (missingModuleFiles.length) {
    recommendations.push('Revisar módulos faltantes para evitar errores de importación.');
  }

  if (missingDirectories.length) {
    recommendations.push('Ejecutar reparación de arranque para reconstruir carpetas locales.');
  }

  if (!recommendations.length) {
    recommendations.push('La estructura base está estable para iniciar la app local.');
  }

  return recommendations;
}

module.exports = {
  runStartupRepair,
  runStartupDiagnostic,
  ensureRequiredDirectories,
  buildStartupRecommendations
};
