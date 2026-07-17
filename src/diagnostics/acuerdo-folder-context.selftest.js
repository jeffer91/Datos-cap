/* =========================================================
Nombre completo: acuerdo-folder-context.selftest.js
Ruta o ubicación: /src/diagnostics/acuerdo-folder-context.selftest.js
Función o funciones:
- Verificar carpetas de capacitación con dos o tres niveles.
- Confirmar que carpetas genéricas como Firmados no se usen como capacitación.
- Verificar coincidencias y conflictos entre carpeta y PDF.
========================================================= */
"use strict";

const {
  deriveFolderContext,
  reconcileAgreementTraining,
  applyAgreementFolderContext
} = require("../document-types/acuerdo-patrocinio/folder-context");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function runAgreementFolderContextSelfTest() {
  const entry = {
    path: "D:\\Acuerdos\\UGPA-RGI2-PRO-134-Diseño Web y Maquetación Digital\\Firmados\\UGPA-RGI2-21-PRO-134-2026-03-Docente.pdf",
    sourceType: "folder",
    rootPath: "D:\\Acuerdos",
    relativePath: "UGPA-RGI2-PRO-134-Diseño Web y Maquetación Digital\\Firmados\\UGPA-RGI2-21-PRO-134-2026-03-Docente.pdf",
    directorySegments: ["UGPA-RGI2-PRO-134-Diseño Web y Maquetación Digital", "Firmados"],
    depth: 2,
    parentFolder: "Firmados"
  };

  const context = deriveFolderContext(entry);
  assertCondition(context.detectedTraining === "Diseño Web y Maquetación Digital", "No se detectó la capacitación desde la carpeta correcta.");
  assertCondition(context.originalTrainingFolder.includes("Diseño Web"), "Se usó una carpeta genérica como capacitación.");

  const confirmed = reconcileAgreementTraining("Diseño Web y Maquetación Digital", context);
  assertCondition(confirmed.status === "CONFIRMADA", "La coincidencia exacta no quedó confirmada.");
  assertCondition(confirmed.similarity === 100, "La coincidencia exacta no obtuvo 100%.");

  const conflict = reconcileAgreementTraining("Auditoría Forense", context);
  assertCondition(conflict.status === "CONFLICTO", "No se detectó el conflicto entre carpeta y PDF.");
  assertCondition(conflict.requiresReview, "El conflicto no quedó marcado para revisión.");

  const folderOnly = reconcileAgreementTraining("", context);
  assertCondition(folderOnly.status === "SOLO_CARPETA", "No se usa la carpeta como respaldo cuando el PDF no contiene capacitación.");

  const document = {
    archivo: { ruta_archivo: entry.path, requiere_revision: "NO", estado_extraccion: "OK", observacion_extraccion: "" },
    datos_acuerdo: { nombre_capacitacion: "Diseño Web y Maquetación Digital", requiere_revision: "NO", observacion_extraccion: "" },
    warnings: []
  };
  applyAgreementFolderContext(document, entry);
  assertCondition(document.archivo.origen_carga === "CARPETA", "No se guardó el origen de carga.");
  assertCondition(document.datos_acuerdo.estado_coincidencia === "CONFIRMADA", "No se guardó el estado de coincidencia.");
  assertCondition(document.datos_acuerdo.ruta_relativa.includes("Firmados"), "No se conservó la ruta relativa.");

  return {
    ok: true,
    detectedTraining: context.detectedTraining,
    confirmedStatus: confirmed.status,
    conflictStatus: conflict.status,
    folderOnlyStatus: folderOnly.status
  };
}

if (require.main === module) {
  try {
    const result = runAgreementFolderContextSelfTest();
    console.log("AGREEMENT_FOLDER_CONTEXT_SELFTEST_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("AGREEMENT_FOLDER_CONTEXT_SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { runAgreementFolderContextSelfTest };