/* =========================================================
Nombre completo: backup-service.test.js
Ruta o ubicación: /src/diagnostics/backup-service.test.js
Función o funciones:
- Probar creación, compresión y validación de respaldos completos.
- Verificar restauración por reemplazo y combinación.
- Confirmar checksum, respaldo de seguridad y retención automática.
- Detectar archivos alterados o dañados antes de restaurar.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const {
  createPersistenceService,
  createBackupService,
  BACKUP_EXTENSION
} = require("../database");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function persistDocument(service, config) {
  const document = {
    document_type: config.documentType,
    id_documento: config.id,
    archivo: {
      id_documento: config.id,
      nombre_archivo: config.fileName,
      ruta_archivo: config.fileName,
      hash_archivo: config.hash,
      codigo_documento: config.code,
      periodo: config.period,
      estado_extraccion: "OK",
      requiere_revision: "NO"
    },
    source: { file_hash: config.hash }
  };

  const result = service.persistProcessingResult({
    definition: {
      id: config.documentType,
      label: config.label,
      processorId: config.documentType,
      uniquePerPeriod: Boolean(config.uniquePerPeriod)
    },
    documentType: config.documentType,
    processorId: config.documentType,
    outputDir: config.outputDir,
    parseResult: { parsedCount: 1, parsed: [document] },
    tableResult: {
      summary: { total_rows: 1 },
      tables: {
        [config.collection]: [{
          id: `${config.id}-row-1`,
          id_documento: config.id,
          codigo_documento: config.code,
          periodo: config.period,
          valor: config.value
        }]
      }
    }
  });

  service.finalizeProcessingRun(result.runId, { ok: true, outputDir: config.outputDir, files: {} });
  return result;
}

function createTamperedBackup(sourcePath, targetPath) {
  const compressed = fs.readFileSync(sourcePath);
  const payload = JSON.parse(zlib.gunzipSync(compressed).toString("utf8"));
  const collectionName = Object.keys(payload.data.collections).find((name) => payload.data.collections[name].length);
  payload.data.collections[collectionName][0].valor = "ALTERADO SIN ACTUALIZAR CHECKSUM";
  fs.writeFileSync(targetPath, zlib.gzipSync(Buffer.from(JSON.stringify(payload), "utf8")));
  return targetPath;
}

function runBackupServiceTest() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-backup-"));
  const databaseDirectory = path.join(tempDirectory, "database");
  const automaticDirectory = path.join(tempDirectory, "automatic-backups");
  const manualBackupPath = path.join(tempDirectory, `respaldo-principal${BACKUP_EXTENSION}`);
  const persistence = createPersistenceService(databaseDirectory);
  const backupService = createBackupService(persistence.database, {
    appVersion: "2.2.0-test",
    backupDirectory: automaticDirectory,
    defaultRetention: 3
  });

  persistDocument(persistence, {
    documentType: "informe-final",
    label: "Informe Final",
    id: "documento-original",
    hash: "hash-original",
    code: "UGPA-INF-01-PRO-134-2026-01",
    period: "2026-01",
    fileName: "informe-original.pdf",
    outputDir: tempDirectory,
    collection: "datos_informe_final",
    value: "contenido original"
  });

  const initialSummary = persistence.getSummary();
  const created = backupService.createBackup(manualBackupPath, { reason: "prueba-manual" });

  assertCondition(created.ok, "No se creó el respaldo manual.");
  assertCondition(fs.existsSync(created.filePath), "El archivo de respaldo no existe.");
  assertCondition(created.filePath.endsWith(BACKUP_EXTENSION), "El respaldo no utiliza la extensión esperada.");
  assertCondition(created.collectionCount >= 3, "El respaldo no incluye todas las colecciones.");
  assertCondition(created.recordCount === initialSummary.totalRecords, "El respaldo perdió registros.");

  const validation = backupService.validateBackup(created.filePath);
  assertCondition(validation.ok, "El respaldo creado no superó su propia validación.");
  assertCondition(validation.summary.recordCount === initialSummary.totalRecords, "La validación reporta otra cantidad de registros.");
  assertCondition(validation.payload.checksum.algorithm === "sha256", "El respaldo no utiliza SHA-256.");

  persistDocument(persistence, {
    documentType: "planificacion-curso",
    label: "Planificación por Curso",
    id: "documento-posterior",
    hash: "hash-posterior",
    code: "UGPA-RGI1-02-PRO-134-2026-02",
    period: "2026-02",
    fileName: "plan-posterior.pdf",
    outputDir: tempDirectory,
    collection: "datos_planificacion_curso",
    value: "dato posterior al respaldo"
  });

  assertCondition(persistence.getSummary().documentCount === 2, "No se preparó la base modificada para restauración.");

  const replaced = backupService.restoreBackup(created.filePath, { mode: "replace" });
  assertCondition(replaced.ok, "La restauración por reemplazo falló.");
  assertCondition(replaced.mode === "replace", "La restauración no informó el modo reemplazo.");
  assertCondition(fs.existsSync(replaced.safetyBackup.filePath), "No se creó el respaldo de seguridad previo.");
  assertCondition(persistence.getSummary().documentCount === 1, "El reemplazo no devolvió la base al estado respaldado.");
  assertCondition(persistence.getDocumentsByPeriod("planificacion-curso", "2026-02").length === 0, "El reemplazo conservó un documento posterior al respaldo.");

  persistDocument(persistence, {
    documentType: "acuerdo-patrocinio",
    label: "Acuerdo de Patrocinio",
    id: "documento-combinado",
    hash: "hash-combinado",
    code: "UGPA-RGI2-03-PRO-134-2026-04",
    period: "2026-04",
    fileName: "acuerdo-combinado.pdf",
    outputDir: tempDirectory,
    collection: "datos_acuerdo_patrocinio",
    value: "registro que debe conservarse"
  });

  const merged = backupService.restoreBackup(created.filePath, { mode: "merge" });
  assertCondition(merged.ok, "La restauración por combinación falló.");
  assertCondition(merged.mode === "merge", "La restauración no informó el modo combinación.");
  assertCondition(persistence.getSummary().documentCount === 2, "La combinación no conservó los datos existentes.");
  assertCondition(persistence.getDocumentsByPeriod("acuerdo-patrocinio", "2026-04").length === 1, "La combinación eliminó el documento actual.");
  assertCondition(persistence.getDocumentsByPeriod("informe-final", "2026-01").length === 1, "La combinación no conservó el documento respaldado.");

  const alteredPath = path.join(tempDirectory, `respaldo-alterado${BACKUP_EXTENSION}`);
  createTamperedBackup(created.filePath, alteredPath);
  const alteredValidation = backupService.validateBackup(alteredPath);
  assertCondition(!alteredValidation.ok, "Un respaldo alterado fue aceptado.");
  assertCondition(alteredValidation.errors.some((error) => /checksum/i.test(error)), "No se informó el error de checksum.");

  backupService.createAutomaticBackup("retencion-1", { retention: 3 });
  backupService.createAutomaticBackup("retencion-2", { retention: 3 });
  backupService.createAutomaticBackup("retencion-3", { retention: 3 });
  backupService.createAutomaticBackup("retencion-4", { retention: 3 });

  const automaticBackups = backupService.listAutomaticBackups();
  assertCondition(automaticBackups.length === 3, "La retención automática no conservó exactamente tres respaldos.");

  const daily = backupService.ensureDailyBackup();
  assertCondition(daily.ok, "La verificación de respaldo diario falló.");
  assertCondition(daily.created === false, "Se creó un respaldo diario duplicado para la misma fecha.");

  const finalSummary = backupService.getSummary();
  assertCondition(finalSummary.automaticBackupCount === 3, "El resumen de respaldos es incorrecto.");
  assertCondition(finalSummary.totalSizeBytes > 0, "El tamaño acumulado de respaldos es inválido.");

  return {
    ok: true,
    tempDirectory,
    manualBackup: created,
    validation: validation.summary,
    replaceSummary: replaced.databaseSummary,
    mergeSummary: merged.databaseSummary,
    automaticBackupCount: finalSummary.automaticBackupCount,
    tamperedBackupRejected: !alteredValidation.ok
  };
}

if (require.main === module) {
  try {
    console.log("BACKUP_SERVICE_OK");
    console.log(JSON.stringify(runBackupServiceTest(), null, 2));
  } catch (error) {
    console.error("BACKUP_SERVICE_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  persistDocument,
  createTamperedBackup,
  runBackupServiceTest
};
