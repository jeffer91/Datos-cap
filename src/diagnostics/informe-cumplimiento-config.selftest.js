"use strict";

const { createComplianceReportService } = require("../informe-cumplimiento");

function assertCondition(condition, message) { if (!condition) throw new Error(message); }

class MemoryDatabase {
  constructor() {
    this.collections = {
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
  }
  readCollection(name) { return JSON.parse(JSON.stringify(this.collections[name] || [])); }
  writeCollection(name, rows) { this.collections[name] = JSON.parse(JSON.stringify(rows || [])); return { records: this.collections[name] }; }
  upsertMany(name, rows, keyField = "id") {
    const current = this.collections[name] || [];
    const index = new Map(current.map((row, i) => [row[keyField], i]));
    rows.forEach((row) => {
      if (index.has(row[keyField])) current[index.get(row[keyField])] = { ...current[index.get(row[keyField])], ...row };
      else current.push({ ...row });
    });
    this.collections[name] = current;
    return { totalAfter: current.length };
  }
}

async function run() {
  const database = new MemoryDatabase();
  const exportService = { async export(_report, sections, payload) { return { ok: true, files: { mock: payload.outputDir }, sectionCount: sections.length, format: payload.format }; } };
  const service = createComplianceReportService(database, { exportService });
  const dashboard = service.getDashboard({ period: "2026" });
  assertCondition(dashboard.guides.length >= 10, "No se cargaron las guías predeterminadas.");
  assertCondition(dashboard.sectionStatuses.length === dashboard.guides.length, "No se construyeron los estados por sección.");

  const guide = dashboard.guides.find((item) => item.id === "conclusiones");
  const savedGuide = service.saveGuide({ ...guide, instructions: `${guide.instructions} Priorizar los tres hallazgos más importantes.` });
  assertCondition(savedGuide.guide.isDefault === false, "No se guardó la guía personalizada.");

  const generated = await service.generateSection({ sectionId: "conclusiones", filters: { period: "2026" }, useAi: false });
  assertCondition(generated.section.status.internal === "GENERADO", "No se generó la sección con el motor interno.");

  const aiConfig = service.saveAiConfiguration({ role: "PRIMARY", name: "Prueba", provider: "OPENAI_COMPATIBLE", endpoint: "https://example.invalid", model: "modelo-prueba", apiKey: "clave-secreta", active: true });
  assertCondition(aiConfig.provider.keyHint === "reta", "No se ocultó correctamente la credencial.");
  assertCondition(!Object.prototype.hasOwnProperty.call(aiConfig.provider, "apiKey"), "La credencial fue expuesta en la respuesta.");

  const exported = await service.exportReport({ filters: { period: "2026" }, outputDir: "/tmp", format: "BOTH", scope: "FULL" });
  assertCondition(exported.ok && exported.sectionCount >= 10, "No se preparó la exportación completa.");
  return { ok: true, guides: dashboard.guides.length, sections: dashboard.sectionStatuses.length, exportFormat: exported.format };
}

if (require.main === module) run().then((value) => { console.log("COMPLIANCE_CONFIG_SELFTEST_OK"); console.log(JSON.stringify(value, null, 2)); }).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { MemoryDatabase, run };
