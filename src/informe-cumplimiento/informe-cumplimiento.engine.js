"use strict";

const STOP_WORDS = new Set(["a", "al", "de", "del", "el", "la", "las", "los", "para", "por", "en", "y", "un", "una", "curso", "taller", "capacitacion", "formacion"]);
const TRAINING_FIELDS = ["nombre_capacitacion", "capacitacion", "tema_capacitacion", "nombre_evento", "evento", "tema", "titulo"];
const NAME_FIELDS = ["nombre_docente", "nombres_apellidos", "nombre_participante", "docente", "participante", "nombre"];
const ID_FIELDS = ["cedula", "cedula_docente", "identificacion", "numero_identificacion", "documento_identidad"];
const PERIOD_FIELDS = ["periodo", "periodo_academico", "anio", "año", "ciclo"];
const CAREER_FIELDS = ["carrera", "carrera_docente", "unidad_academica", "facultad"];
const MODALITY_FIELDS = ["modalidad", "modalidad_capacitacion", "tipo_modalidad"];
const HOURS_FIELDS = ["horas_capacitacion", "total_horas", "horas", "duracion_horas", "numero_horas"];

function text(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
function normalized(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function pick(row, fields) {
  for (const field of fields) {
    const value = text(row?.[field]);
    if (value) return value;
  }
  return "";
}
function teacherName(row) { return pick(row, NAME_FIELDS); }
function teacherId(row) { return pick(row, ID_FIELDS).replace(/\D/g, "").slice(-10); }
function trainingName(row) { return pick(row, TRAINING_FIELDS); }
function period(row) { return pick(row, PERIOD_FIELDS); }
function career(row) { return pick(row, CAREER_FIELDS); }
function modality(row) { return pick(row, MODALITY_FIELDS); }
function hours(row) {
  const match = pick(row, HOURS_FIELDS).replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
function trainingTokens(value) {
  return new Set(normalized(value).split(" ").filter((token) => token && !STOP_WORDS.has(token)));
}
function similarity(left, right) {
  const a = trainingTokens(left); const b = trainingTokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0; a.forEach((token) => { if (b.has(token)) intersection += 1; });
  return intersection / new Set([...a, ...b]).size;
}
function sameTeacher(reference, candidate) {
  const a = teacherId(reference); const b = teacherId(candidate);
  if (a && b) return a === b;
  const left = normalized(teacherName(reference)); const right = normalized(teacherName(candidate));
  return Boolean(left && right && (left === right || similarity(left, right) >= 0.8));
}
function bestTrainingMatch(name, rows, threshold = 0.45) {
  let best = null;
  for (const row of rows || []) {
    const candidate = trainingName(row);
    const score = normalized(name) === normalized(candidate) ? 1 : similarity(name, candidate);
    if (!best || score > best.score) best = { row, score };
  }
  return best && best.score >= threshold ? best : null;
}
function uniqueCount(rows, keyBuilder) {
  return new Set((rows || []).map(keyBuilder).filter(Boolean)).size;
}
function parseNumber(row, fields) {
  for (const field of fields) {
    const match = String(row?.[field] ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return null;
}
function average(values) {
  const numbers = values.filter(Number.isFinite);
  return numbers.length ? Number((numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)) : null;
}
function percentage(value, total) { return total ? Number(((value / total) * 100).toFixed(2)) : 0; }

function matchesFilters(row, filters) {
  if (filters.period && period(row) && normalized(period(row)) !== normalized(filters.period)) return false;
  if (filters.career && career(row) && normalized(career(row)) !== normalized(filters.career)) return false;
  if (filters.modality && modality(row) && normalized(modality(row)) !== normalized(filters.modality)) return false;
  if (filters.query) {
    const haystack = normalized([teacherName(row), trainingName(row), career(row), modality(row), period(row)].join(" "));
    if (!haystack.includes(normalized(filters.query))) return false;
  }
  return true;
}
function optionsFrom(raw) {
  const rows = Object.values(raw).flatMap((value) => Array.isArray(value) ? value : []);
  const values = (selector) => [...new Set(rows.map(selector).map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  return { periods: values(period), careers: values(career), modalities: values(modality) };
}
function buildSnapshot(raw, input = {}) {
  const filters = { period: text(input.period), career: text(input.career), modality: text(input.modality), query: text(input.query) };
  const snapshot = {};
  Object.entries(raw).forEach(([key, rows]) => {
    snapshot[key] = ["documents", "runs"].includes(key) ? rows : (rows || []).filter((row) => matchesFilters(row, filters));
  });
  snapshot.filters = filters;
  snapshot.options = optionsFrom(raw);
  snapshot.generatedAt = new Date().toISOString();
  return snapshot;
}
function documentCheck(name, rows) {
  const match = bestTrainingMatch(name, rows);
  return match ? { exists: true, score: match.score, documentId: text(match.row.id_documento), row: match.row } : { exists: false, score: 0, documentId: "", row: null };
}
function participantPresence(check, participants, teacher) {
  if (!check.exists) return null;
  const rows = (participants || []).filter((row) => text(row.id_documento) === check.documentId);
  if (!rows.length) return null;
  return rows.some((row) => sameTeacher(teacher, row));
}
function buildCoverage(snapshot) {
  const teachers = new Map((snapshot.teachers || []).map((row) => [text(row.id_documento), row]));
  return (snapshot.proposedTrainings || []).filter((row) => trainingName(row)).map((training) => {
    const teacher = teachers.get(text(training.id_documento)) || training;
    const name = trainingName(training);
    const agreementCandidates = (snapshot.agreements || []).filter((row) => sameTeacher(teacher, row));
    const agreement = documentCheck(name, agreementCandidates);
    const planning = documentCheck(name, snapshot.plannings);
    const finalReport = documentCheck(name, snapshot.finalReports);
    const instrument = documentCheck(name, snapshot.instruments);
    const impact = documentCheck(name, snapshot.impacts);
    const finalTeacher = participantPresence(finalReport, snapshot.finalParticipants, teacher);
    const instrumentTeacher = participantPresence(instrument, snapshot.instrumentParticipants, teacher);
    const impactTeacher = participantPresence(impact, snapshot.impactParticipants, teacher);
    const documents = [agreement.exists, planning.exists, finalReport.exists, instrument.exists, impact.exists];
    const people = [finalTeacher, instrumentTeacher, impactTeacher].filter((value) => value !== null);
    return {
      teacherName: teacherName(teacher), trainingName: name, agreement, planning,
      finalReport: { ...finalReport, teacherPresent: finalTeacher },
      instrument: { ...instrument, teacherPresent: instrumentTeacher },
      impact: { ...impact, teacherPresent: impactTeacher },
      complete: documents.every(Boolean) && people.every(Boolean)
    };
  });
}
function documentCompliance(coverage) {
  const total = coverage.length;
  const counts = {
    agreements: coverage.filter((row) => row.agreement.exists).length,
    plannings: coverage.filter((row) => row.planning.exists).length,
    finalReports: coverage.filter((row) => row.finalReport.exists).length,
    instruments: coverage.filter((row) => row.instrument.exists).length,
    impacts: coverage.filter((row) => row.impact.exists).length,
    completeChains: coverage.filter((row) => row.complete).length
  };
  const percentages = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, percentage(value, total)]));
  return { total, counts, percentages, overall: percentage(counts.agreements + counts.plannings + counts.finalReports + counts.instruments + counts.impacts, total * 5) };
}
function calculateMetrics(snapshot, coverage) {
  const compliance = documentCompliance(coverage);
  const satisfaction = average((snapshot.instrumentResults || []).map((row) => parseNumber(row, ["promedio", "resultado_promedio", "puntaje", "valor", "porcentaje"])).filter((value) => value != null));
  const impact = average((snapshot.impactIndicators || []).map((row) => parseNumber(row, ["resultado", "resultado_porcentaje", "porcentaje", "valor_obtenido", "cumplimiento"])).filter((value) => value != null));
  return {
    teachers: uniqueCount(snapshot.teachers, (row) => teacherId(row) || normalized(teacherName(row))),
    proposedTrainings: coverage.length,
    executedTrainings: uniqueCount(snapshot.finalReports, (row) => normalized(trainingName(row)) || row.id_documento),
    plannedHours: Number((snapshot.proposedTrainings || []).reduce((sum, row) => sum + hours(row), 0).toFixed(2)),
    executedHours: Number((snapshot.finalReports || []).reduce((sum, row) => sum + hours(row), 0).toFixed(2)),
    participants: uniqueCount([...(snapshot.finalParticipants || []), ...(snapshot.instrumentParticipants || []), ...(snapshot.impactParticipants || [])], (row) => teacherId(row) || normalized(teacherName(row))),
    agreementsRequired: coverage.length,
    agreementsFound: compliance.counts.agreements,
    documentaryCompliance: compliance.overall,
    completeChains: compliance.counts.completeChains,
    averageSatisfaction: satisfaction,
    averageImpact: impact,
    sourceDocuments: (snapshot.documents || []).length,
    recordsForReview: Object.values(snapshot).filter(Array.isArray).flat().filter((row) => String(row.requiere_revision || "").toUpperCase() === "SI").length,
    documentCompliance: compliance
  };
}
function objectiveAnalysis(snapshot) {
  const rows = [...(snapshot.finalObjectives || []), ...(snapshot.planningEvaluations || [])];
  const counts = { CUMPLIDO: 0, PARCIAL: 0, NO_CUMPLIDO: 0, SIN_EVIDENCIA: 0 };
  rows.forEach((row) => {
    const value = normalized([row.estado, row.cumplimiento, row.resultado, row.observacion].join(" "));
    const key = /no cumpl|incumpl|no alcanz/.test(value) ? "NO_CUMPLIDO" : /parcial|en proceso/.test(value) ? "PARCIAL" : /cumpl|alcanz|lograd/.test(value) ? "CUMPLIDO" : "SIN_EVIDENCIA";
    counts[key] += 1;
  });
  const evidenced = counts.CUMPLIDO + counts.PARCIAL + counts.NO_CUMPLIDO;
  return { total: rows.length, counts, compliancePercentage: evidenced ? percentage(counts.CUMPLIDO + counts.PARCIAL * 0.5, evidenced) : null };
}
function buildGaps(metrics, coverage) {
  const total = metrics.proposedTrainings; const c = metrics.documentCompliance.counts;
  const gap = (code, label, found, priority) => ({ code, label, missing: Math.max(0, total - found), total, percentage: percentage(Math.max(0, total - found), total), priority });
  const rows = [
    gap("MISSING_AGREEMENTS", "Acuerdos de Patrocinio faltantes", c.agreements, "ALTA"),
    gap("MISSING_PLANNINGS", "Planificaciones faltantes", c.plannings, "ALTA"),
    gap("MISSING_FINAL_REPORTS", "Informes finales faltantes", c.finalReports, "ALTA"),
    gap("MISSING_INSTRUMENTS", "Instrumentos de evaluación faltantes", c.instruments, "MEDIA"),
    gap("MISSING_IMPACTS", "Informes de impacto faltantes", c.impacts, "ALTA"),
    gap("INCOMPLETE_CHAINS", "Cadenas documentales incompletas", c.completeChains, "ALTA")
  ];
  const absent = coverage.filter((row) => row.finalReport.teacherPresent === false || row.instrument.teacherPresent === false || row.impact.teacherPresent === false).length;
  rows.push({ code: "TEACHER_NOT_LISTED", label: "Docentes no encontrados en listas colectivas", missing: absent, total, percentage: percentage(absent, total), priority: "MEDIA" });
  return rows.sort((a, b) => b.missing - a.missing);
}
function level(value) { return value >= 85 ? "ALTO" : value >= 65 ? "MEDIO" : "BAJO"; }
function internalAnalysis(metrics, objectives, gaps) {
  const principal = gaps.find((item) => item.missing > 0);
  const findings = [
    { code: "GLOBAL", severity: level(metrics.documentaryCompliance), text: `El cumplimiento documental global es de ${metrics.documentaryCompliance}%.` },
    { code: "EXECUTION", severity: level(percentage(metrics.executedTrainings, metrics.proposedTrainings)), text: `Se identificaron ${metrics.executedTrainings} capacitaciones con Informe Final frente a ${metrics.proposedTrainings} propuestas.` }
  ];
  if (principal) findings.push({ code: "MAIN_GAP", severity: principal.priority, text: `La principal brecha es ${principal.label.toLowerCase()}, con ${principal.missing} caso(s).` });
  findings.push(objectives.compliancePercentage == null
    ? { code: "OBJECTIVES", severity: "MEDIA", text: "No existe evidencia estructurada suficiente para calcular el cumplimiento de objetivos." }
    : { code: "OBJECTIVES", severity: level(objectives.compliancePercentage), text: `El cumplimiento estimado de objetivos es de ${objectives.compliancePercentage}%.` });
  return {
    generatedBy: "INTERNAL_ENGINE", generatedAt: new Date().toISOString(), globalLevel: level(metrics.documentaryCompliance), findings,
    recommendations: gaps.filter((item) => item.missing > 0).slice(0, 5).map((item) => ({ priority: item.priority, text: `Regularizar ${item.label.toLowerCase()} y verificar su trazabilidad en la base local.` })),
    limitations: ["El análisis depende de la calidad de los datos guardados.", "Los datos ausentes no se estiman ni se inventan."]
  };
}
function groupCount(rows, selector) {
  const map = new Map(); (rows || []).forEach((row) => { const key = text(selector(row)) || "Sin dato"; map.set(key, (map.get(key) || 0) + 1); });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
function buildCharts(snapshot, metrics, gaps) {
  return {
    documentaryCoverage: [
      { label: "Acuerdos", value: metrics.documentCompliance.percentages.agreements },
      { label: "Planificaciones", value: metrics.documentCompliance.percentages.plannings },
      { label: "Informes finales", value: metrics.documentCompliance.percentages.finalReports },
      { label: "Instrumentos", value: metrics.documentCompliance.percentages.instruments },
      { label: "Impactos", value: metrics.documentCompliance.percentages.impacts }
    ],
    hoursComparison: [{ label: "Planificadas", value: metrics.plannedHours }, { label: "Ejecutadas", value: metrics.executedHours }],
    trainingsByCareer: groupCount(snapshot.proposedTrainings, career),
    principalGaps: gaps.filter((item) => item.missing > 0).slice(0, 8).map((item) => ({ label: item.label, value: item.missing }))
  };
}
function buildSections(report) {
  const m = report.metrics;
  return [
    { id: "introduccion", title: "Introducción", text: `El presente informe consolida la información de capacitación y formación registrada para ${report.filters.period || "todos los periodos disponibles"}.` },
    { id: "base_documental", title: "Base documental", text: `Se utilizaron ${m.sourceDocuments} documento(s) y las colecciones estructuradas de los seis tipos documentales.` },
    { id: "metodologia", title: "Metodología", text: "La aplicación consulta exclusivamente la base local, normaliza datos, cruza docentes y capacitaciones, calcula métricas y conserva evidencia trazable." },
    { id: "resultados", title: "Resultados generales", text: `Se identificaron ${m.teachers} docente(s), ${m.proposedTrainings} capacitación(es) propuesta(s) y ${m.executedTrainings} con Informe Final.` },
    { id: "cumplimiento", title: "Cumplimiento documental", text: `El cumplimiento documental consolidado es de ${m.documentaryCompliance}%, con ${m.completeChains} cadena(s) completa(s).` },
    { id: "objetivos", title: "Cumplimiento de objetivos", text: report.objectives.compliancePercentage == null ? "Información insuficiente para calcular el cumplimiento de objetivos." : `El cumplimiento estimado de objetivos es de ${report.objectives.compliancePercentage}%.` },
    { id: "evaluacion_impacto", title: "Evaluación e impacto", text: `Satisfacción promedio: ${m.averageSatisfaction ?? "sin dato"}. Impacto promedio: ${m.averageImpact ?? "sin dato"}.` },
    { id: "conclusiones", title: "Conclusiones", text: report.analysis.findings.map((item) => item.text).join(" ") },
    { id: "recomendaciones", title: "Recomendaciones", text: report.analysis.recommendations.map((item) => item.text).join(" ") }
  ];
}
function buildGlobalReport(raw, filters = {}) {
  const snapshot = buildSnapshot(raw, filters);
  const coverage = buildCoverage(snapshot);
  const metrics = calculateMetrics(snapshot, coverage);
  const objectives = objectiveAnalysis(snapshot);
  const gaps = buildGaps(metrics, coverage);
  const analysis = internalAnalysis(metrics, objectives, gaps);
  const report = {
    title: "Informe de Cumplimiento de Capacitación y Formación", generatedAt: snapshot.generatedAt,
    filters: snapshot.filters, options: snapshot.options, coverage, metrics, objectives, gaps, analysis,
    charts: buildCharts(snapshot, metrics, gaps), ai: { status: "PENDING", attempts: [] }
  };
  report.sections = buildSections(report);
  report.validation = {
    ok: true,
    warnings: [
      ...(metrics.teachers ? [] : ["No se encontraron docentes con Plan Individual."]),
      ...(metrics.proposedTrainings ? [] : ["No se encontraron capacitaciones propuestas."]),
      ...(metrics.documentaryCompliance < 100 ? ["La cadena documental presenta brechas."] : [])
    ]
  };
  return report;
}

module.exports = { text, normalized, similarity, sameTeacher, bestTrainingMatch, buildSnapshot, buildCoverage, calculateMetrics, buildGlobalReport };
