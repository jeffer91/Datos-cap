/* =========================================================
Nombre completo: local-database.test.js
Ruta o ubicación: /src/diagnostics/local-database.test.js
Función o funciones:
- Probar creación, persistencia y consulta de la base local.
- Verificar deduplicación por hash en documentos repetitivos.
- Verificar versionado y conservación histórica en documentos únicos.
- Confirmar estadísticas, historial y filas de tablas documentales.
========================================================= */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createPersistenceService } = require("../database");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function parsedDocument(options) {
  const config = options || {};
  return {
    document_type: config.documentType,
    id_documento: config.id,
    archivo: {
      id_documento: config.id,
      nombre_archivo: config.fileName,
      ruta_archivo: config.filePath || config.fileName,
      hash_archivo: config.hash,
      codigo_documento: config.code,
      periodo: config.period,
      estado_extraccion: "OK",
      requiere_revision: "NO"
    },
    source: {
      file_hash: config.hash
    }
  };
}

function persist(service, options) {
  const config = options || {};
  const document = parsedDocument(config);
  return service.persistProcessingResult({
    definition: {
      id: config.documentType,
      label: config.label || config.documentType,
      processorId: config.documentType,
      uniquePerPeriod: Boolean(config.uniquePerPeriod)
    },
    documentType: config.documentType,
    processorId: config.documentType,
    outputDir: config.outputDir,
    parseResult: {
      parsedCount: 1,
      parsed: [document]
    },
    tableResult: {
      summary: { total_rows: 1 },
      tables: {
        [config.tableName]: [{
          id: `${config.id}-row-1`,
          id_documento: config.id,
          codigo_documento: config.code,
          periodo: config.period,
          valor: config.value || "dato"
        }]
      }
    }
  });
}

function runLocalDatabaseTest() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-local-db-"));
  const service = createPersistenceService(tempDirectory);

  const first = persist(service, {
    documentType: "informe-final",
    label: "Informe Final",
    uniquePerPeriod: false,
    id: "doc-repetitivo-1",
    hash: "hash-repetitivo",
    code: "UGPA-INF-01-PRO-134-2026-01",
    period: "2026-01",
    fileName: "informe-1.pdf",
    outputDir: tempDirectory,
    tableName: "datos_informe_final"
  });
  service.finalizeProcessingRun(first.runId, { ok: true, outputDir: tempDirectory, files: { excel: { filePath: "a.xlsx" } } });

  assertCondition(first.documentsSaved === 1, "No se guardó el primer documento repetitivo.");
  assertCondition(first.rowsSaved === 1, "No se guardó la fila del primer documento.");

  const duplicate = persist(service, {
    documentType: "informe-final",
    label: "Informe Final",
    uniquePerPeriod: false,
    id: "doc-repetitivo-movido",
    hash: "hash-repetitivo",
    code: "UGPA-INF-01-PRO-134-2026-01",
    period: "2026-01",
    fileName: "otra-carpeta-informe.pdf",
    outputDir: tempDirectory,
    tableName: "datos_informe_final"
  });
  service.finalizeProcessingRun(duplicate.runId, { ok: true, outputDir: tempDirectory, files: {} });

  assertCondition(duplicate.documentsSaved === 0, "El documento duplicado se guardó nuevamente.");
  assertCondition(duplicate.duplicateDocumentsSkipped === 1, "No se informó el duplicado local.");
  assertCondition(duplicate.rowsSaved === 0, "Se duplicaron filas de un PDF ya registrado.");

  const uniqueV1 = persist(service, {
    documentType: "deteccion-necesidades",
    label: "Detección de Necesidades",
    uniquePerPeriod: true,
    id: "diagnostico-v1",
    hash: "hash-diagnostico-v1",
    code: "UGPA-RGI1-01-PRO-70-2026-03",
    period: "2026-03",
    fileName: "diagnostico-v1.pdf",
    outputDir: tempDirectory,
    tableName: "datos_deteccion_necesidades"
  });
  service.finalizeProcessingRun(uniqueV1.runId, { ok: true, outputDir: tempDirectory, files: {} });

  const uniqueV2 = persist(service, {
    documentType: "deteccion-necesidades",
    label: "Detección de Necesidades",
    uniquePerPeriod: true,
    id: "diagnostico-v2",
    hash: "hash-diagnostico-v2",
    code: "UGPA-RGI1-02-PRO-70-2026-03",
    period: "2026-03",
    fileName: "diagnostico-v2.pdf",
    outputDir: tempDirectory,
    tableName: "datos_deteccion_necesidades"
  });
  service.finalizeProcessingRun(uniqueV2.runId, { ok: true, outputDir: tempDirectory, files: {} });

  assertCondition(uniqueV2.documentsSaved === 1, "No se guardó la nueva versión del documento único.");
  assertCondition(uniqueV2.supersededVersions === 1, "No se superó la versión anterior del periodo.");

  const periodDocuments = service.getDocumentsByPeriod("deteccion-necesidades", "2026-03");
  const active = periodDocuments.filter((record) => record.activo !== false && record.estado_version !== "SUPERADO");
  const superseded = periodDocuments.filter((record) => record.estado_version === "SUPERADO");

  assertCondition(periodDocuments.length === 2, "No se conservaron las dos versiones del documento único.");
  assertCondition(active.length === 1, "Debe existir una sola versión activa por periodo.");
  assertCondition(active[0].id_documento === "diagnostico-v2", "La versión activa no es la más reciente.");
  assertCondition(active[0].version_local === 2, "La nueva versión local no recibió el número 2.");
  assertCondition(superseded.length === 1, "No se conservó la versión superada.");
  assertCondition(superseded[0].superado_por === "diagnostico-v2", "No se enlazó la versión anterior con la nueva.");

  const summary = service.getSummary();
  const runs = service.listRecentRuns({ limit: 10 });

  assertCondition(summary.documentCount === 3, "El total de documentos locales es incorrecto.");
  assertCondition(summary.activeDocumentCount === 2, "El total de documentos activos es incorrecto.");
  assertCondition(summary.processingRunCount === 4, "El historial no contiene cuatro ejecuciones.");
  assertCondition(summary.tableRows === 3, "El total de filas persistidas es incorrecto.");
  assertCondition(runs.length === 4, "No se recuperaron las ejecuciones recientes.");
  assertCondition(runs.every((run) => run.estado === "COMPLETADO"), "Existen ejecuciones sin finalizar.");

  return {
    ok: true,
    tempDirectory,
    summary,
    activeUniqueDocument: active[0],
    supersededUniqueDocument: superseded[0],
    recentRuns: runs.length
  };
}

if (require.main === module) {
  try {
    console.log("LOCAL_DATABASE_OK");
    console.log(JSON.stringify(runLocalDatabaseTest(), null, 2));
  } catch (error) {
    console.error("LOCAL_DATABASE_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  parsedDocument,
  persist,
  runLocalDatabaseTest
};
