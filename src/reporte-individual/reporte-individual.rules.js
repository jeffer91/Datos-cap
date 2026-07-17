/* =========================================================
Nombre completo: reporte-individual.rules.js
Ruta o ubicación: /src/reporte-individual/reporte-individual.rules.js
Función o funciones:
- Definir cuándo un reporte individual puede generarse.
- Separar requisitos obligatorios de documentos de comprobación.
========================================================= */
"use strict";

const STATES = Object.freeze({
  COMPLETE: "COMPLETO",
  GENERABLE_WITH_WARNINGS: "GENERABLE_CON_ADVERTENCIAS",
  NOT_GENERABLE: "NO_GENERABLE"
});

function calculateTrainingStatus(training) {
  const item = training || {};
  if (!item.agreement?.exists) return "FALTA_ACUERDO";
  const validationComplete = Boolean(
    item.planning?.exists &&
    item.finalReport?.exists && item.finalReport?.teacherPresent === true &&
    item.evaluationInstrument?.exists && item.evaluationInstrument?.teacherPresent === true &&
    item.impactReport?.exists && item.impactReport?.teacherPresent === true
  );
  return validationComplete ? "COMPLETA" : "CON_ADVERTENCIAS";
}

function evaluateReport(report) {
  const trainings = Array.isArray(report?.capacitaciones) ? report.capacitaciones : [];
  const hasPlan = Boolean(report?.planIndividual?.exists);
  const hasTrainings = trainings.length > 0;
  const hasAllAgreements = hasTrainings && trainings.every((training) => training.agreement?.exists);
  const canGenerate = hasPlan && hasAllAgreements;
  const validationComplete = canGenerate && trainings.every((training) => calculateTrainingStatus(training) === "COMPLETA");

  return {
    canGenerate,
    validationComplete,
    state: !canGenerate ? STATES.NOT_GENERABLE : validationComplete ? STATES.COMPLETE : STATES.GENERABLE_WITH_WARNINGS,
    missingAgreements: trainings.filter((training) => !training.agreement?.exists).length,
    totalTrainings: trainings.length
  };
}

module.exports = {
  STATES,
  calculateTrainingStatus,
  evaluateReport
};
