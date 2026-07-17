"use strict";
const { createComplianceReportService } = require("../informe-cumplimiento");
function assertCondition(condition, message) { if (!condition) throw new Error(message); }
function createFakeDatabase() {
  const rows = {
    _documents: [{ id_documento: "plan-1" }],
    identificacion_docente: [{ id_documento: "plan-1", nombre_docente: "María Pérez", carrera: "Administración", periodo: "2026" }],
    capacitaciones_propuestas: [{ id_documento: "plan-1", nombre_docente: "María Pérez", nombre_capacitacion: "Planificación DUA", horas_capacitacion: "20", carrera: "Administración", periodo: "2026" }],
    datos_acuerdo_patrocinio: [{ id_documento: "a-1", nombre_docente: "Maria Perez", cedula_docente: "0912345678", nombre_capacitacion: "Planificación de DUA" }],
    datos_planificacion_capacitacion: [{ id_documento: "p-1", nombre_capacitacion: "Curso de Planificación DUA", modalidad: "Virtual" }],
    datos_generales_informe: [{ id_documento: "f-1", nombre_capacitacion: "Planificacion DUA", horas: "20" }],
    participantes_informe: [{ id_documento: "f-1", nombres_apellidos: "María Pérez", cedula: "0912345678" }],
    datos_generales_instrumento: [{ id_documento: "e-1", nombre_capacitacion: "Planificación de DUA" }],
    participantes_instrumento_evaluacion: [{ id_documento: "e-1", nombre_docente: "María Pérez", cedula_docente: "0912345678" }],
    resultados_instrumento_evaluacion: [{ promedio: "4.5" }],
    datos_generales_informe_impacto: [{ id_documento: "i-1", nombre_capacitacion: "Planificación DUA" }],
    participantes_informe_impacto: [{ id_documento: "i-1", nombre_participante: "María Pérez", identificacion: "0912345678" }],
    indicadores_informe_impacto: [{ resultado_porcentaje: "88" }],
    objetivos_informe: [{ estado: "Cumplido" }]
  };
  return { readCollection(name) { return rows[name] || []; } };
}
async function run() {
  const service = createComplianceReportService(createFakeDatabase());
  const result = service.getDashboard({ period: "2026" });
  assertCondition(result.report.metrics.documentaryCompliance === 100, "La cadena documental debería estar completa.");
  assertCondition(result.report.coverage[0].complete, "No se validó el cruce global.");
  assertCondition(result.report.analysis.generatedBy === "INTERNAL_ENGINE", "No se ejecutó el motor interno.");
  const ai = await service.refineWithAi({ period: "2026" });
  assertCondition(ai.ai.status === "INTERNAL_FALLBACK", "La cadena de respaldo no funcionó.");
  return { ok: true, compliance: result.report.metrics.documentaryCompliance, ai: ai.ai.status };
}
if (require.main === module) run().then((value) => { console.log("COMPLIANCE_REPORT_SELFTEST_OK"); console.log(JSON.stringify(value, null, 2)); }).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { createFakeDatabase, run };
