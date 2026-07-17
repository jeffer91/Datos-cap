"use strict";

const DEFAULT_GUIDES = Object.freeze([
  {
    id: "general",
    title: "Guía general",
    instructions: "Redactar con tono institucional, precisión técnica y trazabilidad. No modificar cifras, no inventar datos y diferenciar claramente hechos, interpretación y recomendaciones.",
    dataScope: ["metrics", "objectives", "gaps", "analysis", "charts"],
    tone: "Institucional, claro y ejecutivo",
    maxWords: 700,
    providerPreference: "AUTO",
    enabled: true,
    order: 0
  },
  {
    id: "introduccion",
    title: "Introducción",
    instructions: "Presentar el propósito, alcance, periodo analizado y naturaleza global del informe sin adelantar conclusiones no demostradas.",
    dataScope: ["filters", "metrics", "validation"],
    tone: "Institucional y contextual",
    maxWords: 350,
    providerPreference: "AUTO",
    enabled: true,
    order: 1
  },
  {
    id: "base-documental",
    title: "Base documental",
    instructions: "Explicar la cobertura de los documentos procesados, su relación con la base local y las limitaciones de calidad o información faltante.",
    dataScope: ["metrics", "documentCompliance", "gaps", "validation"],
    tone: "Técnico y verificable",
    maxWords: 450,
    providerPreference: "AUTO",
    enabled: true,
    order: 2
  },
  {
    id: "metodologia",
    title: "Metodología",
    instructions: "Describir consolidación de la base, cruces por cédula, normalización de nombres de capacitación, reglas de cumplimiento y tratamiento de datos incompletos.",
    dataScope: ["filters", "methodology", "validation"],
    tone: "Técnico y didáctico",
    maxWords: 500,
    providerPreference: "AUTO",
    enabled: true,
    order: 3
  },
  {
    id: "resultados",
    title: "Resultados generales",
    instructions: "Interpretar docentes, capacitaciones, horas, participación y ejecución. Destacar relaciones relevantes sin atribuir causalidad que no esté demostrada.",
    dataScope: ["metrics", "charts", "coverage"],
    tone: "Analítico y ejecutivo",
    maxWords: 700,
    providerPreference: "AUTO",
    enabled: true,
    order: 4
  },
  {
    id: "cumplimiento-objetivos",
    title: "Cumplimiento de objetivos",
    instructions: "Analizar objetivos cumplidos, parciales, no cumplidos y sin evidencia. Indicar expresamente cuando la información no sea suficiente.",
    dataScope: ["objectives", "analysis", "evidence"],
    tone: "Analítico y prudente",
    maxWords: 600,
    providerPreference: "AUTO",
    enabled: true,
    order: 5
  },
  {
    id: "participacion",
    title: "Participación",
    instructions: "Analizar cobertura de docentes y participantes por carrera, modalidad y capacitación, evitando duplicar personas cuando exista cédula disponible.",
    dataScope: ["metrics", "charts", "coverage"],
    tone: "Analítico y descriptivo",
    maxWords: 550,
    providerPreference: "AUTO",
    enabled: true,
    order: 6
  },
  {
    id: "evaluacion",
    title: "Evaluación",
    instructions: "Interpretar los resultados disponibles de instrumentos de evaluación, satisfacción y observaciones. No asumir resultados cuando no existan registros suficientes.",
    dataScope: ["metrics", "evaluation", "validation"],
    tone: "Técnico y equilibrado",
    maxWords: 550,
    providerPreference: "AUTO",
    enabled: true,
    order: 7
  },
  {
    id: "impacto",
    title: "Impacto",
    instructions: "Interpretar indicadores, resultados y cambios observados en los informes de impacto. Diferenciar resultados medidos de opiniones o descripciones.",
    dataScope: ["metrics", "impact", "gaps", "validation"],
    tone: "Analítico y prudente",
    maxWords: 600,
    providerPreference: "AUTO",
    enabled: true,
    order: 8
  },
  {
    id: "brechas",
    title: "Brechas y alertas",
    instructions: "Ordenar brechas por magnitud y prioridad, explicar su efecto en el cumplimiento y conservar visibles las limitaciones documentales.",
    dataScope: ["gaps", "metrics", "coverage", "validation"],
    tone: "Directo y orientado a riesgos",
    maxWords: 600,
    providerPreference: "AUTO",
    enabled: true,
    order: 9
  },
  {
    id: "conclusiones",
    title: "Conclusiones",
    instructions: "Sintetizar los hallazgos más importantes y vincular cada conclusión con una evidencia numérica o documental disponible.",
    dataScope: ["analysis", "metrics", "objectives", "gaps"],
    tone: "Ejecutivo e institucional",
    maxWords: 550,
    providerPreference: "AUTO",
    enabled: true,
    order: 10
  },
  {
    id: "recomendaciones",
    title: "Recomendaciones",
    instructions: "Proponer acciones concretas, priorizadas y relacionadas directamente con las brechas detectadas. Evitar recomendaciones genéricas sin respaldo.",
    dataScope: ["analysis", "gaps", "metrics", "objectives"],
    tone: "Práctico y orientado a mejora",
    maxWords: 550,
    providerPreference: "AUTO",
    enabled: true,
    order: 11
  },
  {
    id: "anexos",
    title: "Anexos",
    instructions: "Organizar tablas de respaldo, detalle por carrera, capacitación y alertas. No redactar conclusiones nuevas en esta sección.",
    dataScope: ["coverage", "charts", "gaps", "metrics"],
    tone: "Técnico y tabular",
    maxWords: 250,
    providerPreference: "INTERNAL",
    enabled: true,
    order: 12
  }
]);

function cloneDefaults() {
  return DEFAULT_GUIDES.map((guide) => ({ ...guide, dataScope: [...guide.dataScope] }));
}

module.exports = { DEFAULT_GUIDES, cloneDefaults };
