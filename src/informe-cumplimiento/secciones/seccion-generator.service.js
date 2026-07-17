"use strict";

const { validateSection } = require("./seccion.validator");

function text(value) { return String(value == null ? "" : value).trim(); }
function listText(items) { return (items || []).map((item) => `• ${text(item.text || item.message || item.label || item)}`).join("\n"); }

class SectionGeneratorService {
  constructor(sectionRepository) { this.repository = sectionRepository; }

  findBaseSection(report, guide) {
    const aliases = {
      "base-documental": ["base-documental", "base_documental", "documental"],
      "cumplimiento-objetivos": ["cumplimiento-objetivos", "objetivos", "cumplimiento"],
      participacion: ["participacion", "participación"],
      brechas: ["brechas", "alertas"],
      anexos: ["anexos"]
    };
    const ids = aliases[guide.id] || [guide.id];
    return (report.sections || []).find((section) => ids.includes(section.id)) || null;
  }

  fallbackContent(report, guide) {
    const metrics = report.metrics || {};
    const objectives = report.objectives || {};
    const gaps = (report.gaps || []).filter((gap) => gap.missing > 0);
    const findings = report.analysis?.findings || [];
    const recommendations = report.analysis?.recommendations || [];
    const common = `El periodo analizado registra ${metrics.teachers || 0} docente(s), ${metrics.proposedTrainings || 0} capacitación(es) propuesta(s) y ${metrics.executedTrainings || 0} capacitación(es) con evidencia de ejecución. El cumplimiento documental global calculado es de ${metrics.documentaryCompliance || 0}%.`;
    const contentById = {
      general: `${common}\n\nEl análisis se construye exclusivamente con registros disponibles en la base local y conserva las advertencias de calidad de datos.`,
      introduccion: "El presente informe consolida la información institucional de capacitación y formación disponible en la base local para el periodo seleccionado. Su finalidad es presentar resultados, nivel de cumplimiento, brechas y elementos de mejora con base en evidencias verificables.",
      "base-documental": `${common}\n\nSe identificaron ${metrics.sourceDocuments || 0} documentos fuente y ${metrics.recordsForReview || 0} registro(s) marcados para revisión.`,
      metodologia: "La metodología comprende consolidación de colecciones locales, normalización de textos, cruce de docentes por cédula y nombre, comparación tolerante de capacitaciones y aplicación de reglas deterministas de cumplimiento. Los datos ausentes se mantienen como información no disponible y no se completan por inferencia.",
      resultados: `${common}\n\nLas horas planificadas suman ${metrics.plannedHours || 0} y las horas ejecutadas identificadas suman ${metrics.executedHours || 0}.`,
      "cumplimiento-objetivos": objectives.compliancePercentage == null
        ? "No existe evidencia estructurada suficiente para calcular un porcentaje consolidado de cumplimiento de objetivos."
        : `El cumplimiento estimado de objetivos es de ${objectives.compliancePercentage}%.`,
      participacion: `Se identificaron ${metrics.participants || 0} participante(s) únicos considerando preferentemente la cédula. La cifra debe interpretarse según la disponibilidad de listas en los documentos colectivos.`,
      evaluacion: metrics.averageSatisfaction == null
        ? "No existe información estructurada suficiente para calcular una satisfacción promedio global."
        : `La satisfacción promedio disponible es de ${metrics.averageSatisfaction}.`,
      impacto: metrics.averageImpact == null
        ? "No existe información estructurada suficiente para calcular un indicador promedio de impacto."
        : `El resultado promedio de impacto disponible es de ${metrics.averageImpact}.`,
      brechas: gaps.length ? `Las principales brechas detectadas son:\n${gaps.slice(0, 8).map((gap) => `• ${gap.label}: ${gap.missing} caso(s), prioridad ${gap.priority}.`).join("\n")}` : "No se detectaron brechas documentales en el conjunto filtrado.",
      conclusiones: findings.length ? listText(findings) : common,
      recomendaciones: recommendations.length ? listText(recommendations) : "Mantener la actualización de la base y revisar periódicamente los registros marcados con advertencias.",
      anexos: "El anexo técnico contiene métricas, cobertura por capacitación, brechas y datos agregados que respaldan las secciones del informe."
    };
    return contentById[guide.id] || common;
  }

  evidenceFor(report, guide) {
    const evidence = [];
    const metrics = report.metrics || {};
    if ((guide.dataScope || []).includes("metrics")) {
      Object.entries(metrics).forEach(([key, value]) => {
        if (["string", "number"].includes(typeof value) || value === null) evidence.push({ source: `metrics.${key}`, value });
      });
    }
    if ((guide.dataScope || []).includes("gaps")) {
      (report.gaps || []).slice(0, 20).forEach((gap) => evidence.push({ source: `gaps.${gap.code}`, value: `${gap.missing}/${gap.total}` }));
    }
    if ((guide.dataScope || []).includes("objectives")) evidence.push({ source: "objectives", value: report.objectives || {} });
    return evidence;
  }

  generate(report, guide, options = {}) {
    const base = this.findBaseSection(report, guide);
    const section = {
      id: guide.id,
      title: guide.title,
      content: text(base?.text) || this.fallbackContent(report, guide),
      guideId: guide.id,
      generatedBy: "INTERNAL_ENGINE",
      generatedAt: new Date().toISOString(),
      evidence: this.evidenceFor(report, guide),
      status: {
        data: report.validation?.warnings?.length ? "DISPONIBLE_CON_ADVERTENCIAS" : "DISPONIBLE",
        internal: "GENERADO",
        ai: "NO_EJECUTADA",
        validation: "PENDIENTE"
      }
    };
    const validation = validateSection(section);
    section.validation = validation;
    section.status.validation = validation.ok ? "CORRECTA" : "REVISAR";
    if (options.persist !== false && this.repository) return this.repository.save(section, report.filters || {});
    return section;
  }

  generateAll(report, guides, options = {}) {
    return (guides || []).filter((guide) => guide.enabled !== false).map((guide) => this.generate(report, guide, options));
  }

  statuses(report, guides, savedSections = []) {
    const savedMap = new Map((savedSections || []).map((section) => [section.sectionId || section.id, section]));
    return (guides || []).filter((guide) => guide.enabled !== false).map((guide) => {
      const saved = savedMap.get(guide.id);
      const base = saved || this.generate(report, guide, { persist: false });
      return {
        id: guide.id,
        title: guide.title,
        status: base.status,
        generatedAt: base.generatedAt,
        warnings: base.validation?.issues || [],
        hasSavedVersion: Boolean(saved)
      };
    });
  }
}

module.exports = { SectionGeneratorService };
