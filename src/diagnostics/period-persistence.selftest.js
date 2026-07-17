/* =========================================================
Nombre completo: period-persistence.selftest.js
Ruta o ubicación: /src/diagnostics/period-persistence.selftest.js
Función o funciones:
- Verificar que Planes y Acuerdos guarden periodo en todas sus tablas.
- Verificar filtros de la Base local por periodo.
- Verificar la reparación automática de registros antiguos.
========================================================= */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { createPersistenceService, createQueryService } = require("../database");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function runPeriodPersistenceSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-periodos-"));
  const persistence = createPersistenceService(tempDir);

  const planId = "doc_plan_periodo_2025_10";
  const planResult = persistence.persistProcessingResult({
    documentType: "plan-individual",
    outputDir: tempDir,
    parsedDocuments: [{
      id_documento: planId,
      archivo: {
        id_documento: planId,
        nombre_archivo: "UGPA-RGI1-01-PRO-251-2025-10-Docente.pdf",
        ruta_archivo: "mock-plan.pdf",
        hash_archivo: "hash-plan-periodo",
        codigo_documento: "UGPA-RGI1-01-PRO-251-2025-10",
        periodo: "2025-10"
      },
      identificacion: {
        id_documento: planId,
        codigo_documento: "UGPA-RGI1-01-PRO-251-2025-10",
        nombre_docente: "Docente Plan",
        carrera: "Tecnología"
      }
    }],
    tables: {
      identificacion_docente: [{
        id: "identificacion_plan_periodo",
        id_documento: planId,
        codigo_documento: "UGPA-RGI1-01-PRO-251-2025-10",
        nombre_docente: "Docente Plan",
        carrera: "Tecnología"
      }],
      capacitaciones_propuestas: [{
        id: "capacitacion_plan_periodo",
        id_documento: planId,
        codigo_documento: "UGPA-RGI1-01-PRO-251-2025-10",
        nombre_docente: "Docente Plan",
        nombre_capacitacion: "Metodologías Ágiles"
      }]
    },
    summary: {}
  });

  const agreementId = "doc_agreement_periodo_2026_03";
  const agreementResult = persistence.persistProcessingResult({
    documentType: "acuerdo-patrocinio",
    outputDir: tempDir,
    parsedDocuments: [{
      id_documento: agreementId,
      archivo: {
        id_documento: agreementId,
        nombre_archivo: "UGPA-RGI2-01-PRO-134-2026-03-Docente.pdf",
        ruta_archivo: "mock-agreement.pdf",
        hash_archivo: "hash-agreement-periodo",
        codigo_documento: "UGPA-RGI2-01-PRO-134-2026-03",
        periodo: "2026-03"
      },
      datos_acuerdo: {
        id_documento: agreementId,
        codigo_documento: "UGPA-RGI2-01-PRO-134-2026-03",
        nombre_docente: "Docente Acuerdo",
        cedula_docente: "0123456789",
        nombre_capacitacion: "Auditoría Forense"
      }
    }],
    tables: {
      datos_acuerdo_patrocinio: [{
        id: "datos_agreement_periodo",
        id_documento: agreementId,
        codigo_documento: "UGPA-RGI2-01-PRO-134-2026-03",
        nombre_docente: "Docente Acuerdo",
        nombre_capacitacion: "Auditoría Forense"
      }],
      apoyos_acuerdo_patrocinio: [{
        id: "apoyo_agreement_periodo",
        id_documento: agreementId,
        codigo_documento: "UGPA-RGI2-01-PRO-134-2026-03",
        tipo_apoyo: "Ajuste de horario laboral",
        seleccionado: "SI"
      }]
    },
    summary: {}
  });

  assertCondition(planResult.documentsSaved === 1, "No se guardó el Plan de prueba.");
  assertCondition(agreementResult.documentsSaved === 1, "No se guardó el Acuerdo de prueba.");

  const planRows = persistence.database.readCollection("identificacion_docente");
  const trainingRows = persistence.database.readCollection("capacitaciones_propuestas");
  const agreementRows = persistence.database.readCollection("datos_acuerdo_patrocinio");
  const supportRows = persistence.database.readCollection("apoyos_acuerdo_patrocinio");

  assertCondition(planRows[0].periodo === "2025-10", "Identificación del Plan sin periodo.");
  assertCondition(trainingRows[0].periodo === "2025-10", "Capacitación propuesta sin periodo.");
  assertCondition(planRows[0].anio_periodo === "2025" && planRows[0].mes_periodo === "10", "Año o mes del Plan incorrectos.");
  assertCondition(agreementRows[0].periodo === "2026-03", "Datos del Acuerdo sin periodo.");
  assertCondition(supportRows[0].periodo === "2026-03", "Apoyo del Acuerdo sin periodo.");

  const query = createQueryService(persistence.database);
  assertCondition(query.listTypeRecords("plan-individual", { period: "2025-10" }).records.length === 1, "El filtro del Plan por periodo no funciona.");
  assertCondition(query.listTypeRecords("plan-individual", { period: "2026-03" }).records.length === 0, "El filtro del Plan mezcló periodos.");
  assertCondition(query.listTypeRecords("acuerdo-patrocinio", { period: "2026-03" }).records.length === 1, "El filtro del Acuerdo por periodo no funciona.");
  assertCondition(query.listDocuments({ period: "2025-10" }).length === 1, "La colección de documentos no filtra el periodo del Plan.");

  const legacyRows = persistence.database.readCollection("identificacion_docente").map((row) => {
    const copy = { ...row };
    delete copy.periodo;
    delete copy.anio_periodo;
    delete copy.mes_periodo;
    return copy;
  });
  persistence.database.replaceCollection("identificacion_docente", legacyRows);

  const reopened = createPersistenceService(tempDir);
  const repaired = reopened.database.readCollection("identificacion_docente")[0];
  assertCondition(repaired.periodo === "2025-10", "No se reparó el periodo de un registro antiguo.");
  assertCondition(reopened.lastPeriodBackfill.rowsUpdated >= 1, "La migración no informó filas reparadas.");

  const summary = createQueryService(reopened.database).getSummary();
  assertCondition(summary.periods.includes("2025-10") && summary.periods.includes("2026-03"), "El resumen no enumera los periodos guardados.");
  assertCondition(summary.documentsByPeriod["2025-10"] === 1, "Conteo del periodo 2025-10 incorrecto.");
  assertCondition(summary.documentsByPeriod["2026-03"] === 1, "Conteo del periodo 2026-03 incorrecto.");

  return {
    ok: true,
    tempDir,
    planPeriod: repaired.periodo,
    agreementPeriod: agreementRows[0].periodo,
    periods: summary.periods,
    backfill: reopened.lastPeriodBackfill
  };
}

if (require.main === module) {
  try {
    const result = runPeriodPersistenceSelfTest();
    console.log("PERIOD_PERSISTENCE_SELFTEST_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("PERIOD_PERSISTENCE_SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { runPeriodPersistenceSelfTest };