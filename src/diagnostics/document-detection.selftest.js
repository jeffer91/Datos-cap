/* =========================================================
Nombre completo: document-detection.selftest.js
Ruta o ubicación: /src/diagnostics/document-detection.selftest.js
Función o funciones:
- Verificar que los códigos institucionales tengan prioridad sobre frases incidentales.
- Evitar que planes RGI1 PRO-251 se clasifiquen como informes de impacto.
========================================================= */
"use strict";

const {
  detectDocumentType,
  detectDocumentTypeDetailed
} = require("../validators/document-selection.validator");

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function runDocumentDetectionSelfTest() {
  const planNames = [
    "UGPA-RGI1-01-PRO-251-2025-10-Willian Rodrigo Espinoza Perez.pdf",
    "UGPA-RGI1-01-PRO-251-2026-03-Velasco Alarcon Luis Alberto-signed_firmado.pdf",
    "UGPA-RGI1-06-PRO251-2026-03-Paúl Andrés Triviño Tipán-signed_firmado.pdf",
    "UGPA-RGI1-20-PRO-251-2026-03-Henry Fabricio Morales Zuñiga (1)-signed_firmado.pdf"
  ];

  const misleadingPlanBody = `
    PLAN INDIVIDUAL DE FORMACIÓN Y CAPACITACIÓN DOCENTE
    Código UGPA-RGI1-01-PRO-251-2025-10
    El seguimiento posterior podrá considerar un informe de impacto de la capacitación.
    CAPACITACIONES PROPUESTAS
    FORMACIÓN ACADÉMICA PROPUESTA
  `;

  planNames.forEach((fileName) => {
    assertCondition(
      detectDocumentType(misleadingPlanBody, fileName) === "plan-individual",
      `El archivo ${fileName} fue clasificado incorrectamente.`
    );
  });

  const detailed = detectDocumentTypeDetailed(misleadingPlanBody, planNames[0]);
  assertCondition(detailed.type === "plan-individual", "La detección detallada no reconoce el Plan Individual.");
  assertCondition(detailed.confidence >= 96, "La detección por código institucional debe tener confianza alta.");
  assertCondition(/RGI1 \+ PRO-251/.test(detailed.reason), "La razón no informa el código institucional utilizado.");

  assertCondition(
    detectDocumentType("ACUERDO DE PATROCINIO INSTITUCIONAL", "UGPA-RGI2-01-PRO-134-2026-03.pdf") === "acuerdo-patrocinio",
    "No se reconoce el Acuerdo de Patrocinio."
  );
  assertCondition(
    detectDocumentType("PLANIFICACIÓN DE LA CAPACITACIÓN", "UGPA-RGI1-05-PRO-134-2026-03.pdf") === "planificacion-capacitacion",
    "No se reconoce la Planificación de Capacitación."
  );
  assertCondition(
    detectDocumentType("INFORME FINAL DE LA CAPACITACIÓN", "UGPA-INF-01-PRO-134-2026-03.pdf") === "informe-final-capacitacion",
    "No se reconoce el Informe Final."
  );
  assertCondition(
    detectDocumentType("INSTRUMENTO DE EVALUACIÓN DE LA CAPACITACIÓN", "UGPA-RGI1-01-PRO-135-2026-03.pdf") === "instrumento-evaluacion",
    "No se reconoce el Instrumento de Evaluación."
  );
  assertCondition(
    detectDocumentType("INFORME DE IMPACTO DE LA CAPACITACIÓN", "UGPA-INF-01-PRO-135-2026-05.pdf") === "informe-impacto",
    "No se reconoce el Informe de Impacto."
  );

  return {
    ok: true,
    planCases: planNames.length,
    detectedType: detailed.type,
    confidence: detailed.confidence,
    reason: detailed.reason
  };
}

if (require.main === module) {
  try {
    const result = runDocumentDetectionSelfTest();
    console.log("DOCUMENT_DETECTION_SELFTEST_OK");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("DOCUMENT_DETECTION_SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { runDocumentDetectionSelfTest };
