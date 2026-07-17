/* =========================================================
Nombre completo: reporte-individual.validator.js
Ruta o ubicación: /src/reporte-individual/reporte-individual.validator.js
Función o funciones:
- Validar la estructura consolidada del reporte individual.
- Explicar por qué un reporte puede o no puede generarse.
========================================================= */
"use strict";

function validateIndividualReport(report) {
  const errors = [];
  const warnings = [];
  const trainings = Array.isArray(report?.capacitaciones) ? report.capacitaciones : [];

  if (!report?.docente?.nombre) errors.push("Falta el nombre del docente.");
  if (!report?.planIndividual?.exists) errors.push("Falta el Plan Individual.");
  if (!trainings.length) errors.push("No existen capacitaciones reconocidas en el Plan Individual.");

  trainings.forEach((training, index) => {
    const label = training.nombre || `Capacitación ${index + 1}`;
    if (!training.agreement?.exists) errors.push(`Falta el Acuerdo de Patrocinio de ${label}.`);
    (training.alerts || []).forEach((alert) => {
      if (alert.code !== "MISSING_AGREEMENT") warnings.push(`${label}: ${alert.message}`);
    });
  });

  if (!report?.docente?.cedula) warnings.push("La cédula del docente no pudo determinarse desde los acuerdos.");

  return {
    ok: errors.length === 0,
    canGenerate: errors.length === 0,
    errors,
    warnings,
    state: errors.length ? "NO_GENERABLE" : warnings.length ? "GENERABLE_CON_ADVERTENCIAS" : "COMPLETO"
  };
}

module.exports = { validateIndividualReport };
