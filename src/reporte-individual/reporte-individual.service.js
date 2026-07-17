/* =========================================================
Nombre completo: reporte-individual.service.js
Ruta o ubicación: /src/reporte-individual/reporte-individual.service.js
Función o funciones:
- Coordinar consultas, cruces, validación y preparación del reporte individual.
- Entregar listados resumidos y el detalle completo por docente.
========================================================= */
"use strict";

const { createIndividualReportQuery } = require("./reporte-individual.query");
const { buildAllTeacherReports } = require("./reporte-individual.builder");
const { validateIndividualReport } = require("./reporte-individual.validator");
const { buildIndividualReportDraft } = require("./reporte-individual.exporter");
const { normalizeCedula, normalizeTeacherName } = require("./docente.matcher");

function text(value) { return String(value == null ? "" : value).trim(); }

class IndividualReportService {
  constructor(database) {
    this.query = createIndividualReportQuery(database);
  }

  getReports() {
    return buildAllTeacherReports(this.query.loadSnapshot());
  }

  listTeachers(options = {}) {
    const query = text(options.query).toLowerCase();
    const status = text(options.status);
    return this.getReports()
      .filter((report) => !status || report.estadoGeneral === status)
      .filter((report) => {
        if (!query) return true;
        const haystack = [
          report.docente.nombre,
          report.docente.cedula,
          report.docente.carrera,
          ...report.capacitaciones.map((training) => training.nombre)
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .map((report) => ({
        key: report.key,
        nombre: report.docente.nombre,
        cedula: report.docente.cedula,
        carrera: report.docente.carrera,
        totalCapacitaciones: report.capacitaciones.length,
        acuerdosEncontrados: report.capacitaciones.filter((training) => training.agreement.exists).length,
        estadoGeneral: report.estadoGeneral,
        puedeGenerar: report.puedeGenerar,
        alertas: report.alerts.length
      }));
  }

  getTeacherReport(key) {
    const cleanKey = text(key);
    const report = this.getReports().find((item) => item.key === cleanKey);
    if (!report) throw new Error("No se encontró el docente solicitado en los Planes Individuales guardados.");
    return report;
  }

  findTeacher(value) {
    const clean = text(value);
    const cedula = normalizeCedula(clean);
    const name = normalizeTeacherName(clean);
    return this.getReports().find((report) =>
      (cedula && report.docente.cedula === cedula) ||
      (name && report.docente.nombreNormalizado === name)
    ) || null;
  }

  prepareReport(key) {
    const report = this.getTeacherReport(key);
    const validation = validateIndividualReport(report);
    if (!validation.canGenerate) {
      return {
        ok: false,
        message: "El reporte no puede generarse porque falta el Plan Individual, una capacitación reconocida o uno de los acuerdos requeridos.",
        validation,
        report
      };
    }
    return {
      ok: true,
      message: validation.warnings.length
        ? "El reporte está listo para generarse con advertencias de comprobación."
        : "El reporte está completo y listo para generarse.",
      validation,
      draft: buildIndividualReportDraft(report, validation),
      report
    };
  }
}

function createIndividualReportService(database) {
  return new IndividualReportService(database);
}

module.exports = {
  IndividualReportService,
  createIndividualReportService
};
