/* =========================================================
Nombre completo: reporte-individual.builder.js
Ruta o ubicación: /src/reporte-individual/reporte-individual.builder.js
Función o funciones:
- Construir un reporte por docente a partir de la base local.
- Desglosar cada capacitación y comprobar su cadena documental.
========================================================= */
"use strict";

const {
  normalizeCedula,
  normalizeTeacherName,
  pickCedula,
  pickTeacherName,
  matchTeacher,
  findBestTeacherMatch
} = require("./docente.matcher");
const {
  normalizeTrainingName,
  pickTrainingName,
  findBestTrainingMatch
} = require("./capacitacion.matcher");
const { evaluateReport, calculateTrainingStatus } = require("./reporte-individual.rules");

function text(value) { return String(value == null ? "" : value).trim(); }
function rowsByDocument(rows, documentId) {
  return (Array.isArray(rows) ? rows : []).filter((row) => text(row.id_documento) === text(documentId));
}

function trainingReference(row) {
  return {
    name: pickTrainingName(row),
    normalized: normalizeTrainingName(pickTrainingName(row)),
    record: row || {}
  };
}

function teacherReference(plan, cedula = "") {
  return {
    nombre_docente: pickTeacherName(plan),
    cedula: normalizeCedula(cedula || pickCedula(plan)),
    carrera: text(plan?.carrera),
    id_documento_plan: text(plan?.id_documento)
  };
}

function findAgreement(planTeacher, trainingName, agreements) {
  const teacherCandidates = (Array.isArray(agreements) ? agreements : []).filter((row) => {
    const result = matchTeacher(planTeacher, row);
    return result.matched || result.score >= 0.72;
  });
  const match = findBestTrainingMatch(trainingName, teacherCandidates);
  if (!match) return null;
  const teacherMatch = matchTeacher(planTeacher, match.record);
  return { ...match, teacherMatch };
}

function findCollectiveDocument(trainingName, records) {
  return findBestTrainingMatch(trainingName, records);
}

function participantCheck(documentMatch, participantRows, teacher) {
  if (!documentMatch) {
    return {
      exists: false,
      documentId: "",
      trainingName: "",
      matchLevel: "SIN_COINCIDENCIA",
      matchScore: 0,
      teacherPresent: null,
      participantStatus: "DOCUMENTO_NO_ENCONTRADO",
      teacherMatchMethod: ""
    };
  }

  const documentId = text(documentMatch.record?.id_documento);
  const participants = rowsByDocument(participantRows, documentId);
  if (!participants.length) {
    return {
      exists: true,
      documentId,
      trainingName: pickTrainingName(documentMatch.record),
      matchLevel: documentMatch.level,
      matchScore: documentMatch.score,
      teacherPresent: null,
      participantStatus: "LISTA_NO_DISPONIBLE",
      teacherMatchMethod: ""
    };
  }

  const match = findBestTeacherMatch(teacher, participants);
  return {
    exists: true,
    documentId,
    trainingName: pickTrainingName(documentMatch.record),
    matchLevel: documentMatch.level,
    matchScore: documentMatch.score,
    teacherPresent: Boolean(match),
    participantStatus: match ? "DOCENTE_ENCONTRADO" : "DOCENTE_NO_ENCONTRADO",
    teacherMatchMethod: match?.method || "",
    teacherMatchScore: match?.score || 0,
    participantRecord: match?.record || null
  };
}

function simpleDocumentCheck(documentMatch) {
  if (!documentMatch) {
    return { exists: false, documentId: "", trainingName: "", matchLevel: "SIN_COINCIDENCIA", matchScore: 0 };
  }
  return {
    exists: true,
    documentId: text(documentMatch.record?.id_documento),
    trainingName: pickTrainingName(documentMatch.record),
    matchLevel: documentMatch.level,
    matchScore: documentMatch.score,
    record: documentMatch.record
  };
}

function buildAlerts(training) {
  const alerts = [];
  if (!training.agreement.exists) alerts.push({ level: "WARNING", code: "MISSING_AGREEMENT", message: "Falta el Acuerdo de Patrocinio para esta capacitación." });
  if (!training.planning.exists) alerts.push({ level: "WARNING", code: "MISSING_PLANNING", message: "No se encontró la Planificación de la capacitación." });

  [
    ["Informe Final", training.finalReport],
    ["Instrumento de Evaluación", training.evaluationInstrument],
    ["Informe de Impacto", training.impactReport]
  ].forEach(([label, item]) => {
    if (!item.exists) {
      alerts.push({ level: "WARNING", code: `MISSING_${label.toUpperCase().replace(/\s+/g, "_")}`, message: `No se encontró el ${label}.` });
    } else if (item.teacherPresent === false) {
      alerts.push({ level: "WARNING", code: "TEACHER_NOT_FOUND", message: `El docente no aparece en la lista del ${label}.` });
    } else if (item.teacherPresent == null) {
      alerts.push({ level: "WARNING", code: "PARTICIPANT_LIST_UNAVAILABLE", message: `No se pudo comprobar la lista de docentes del ${label}.` });
    }
  });

  [training.agreement, training.planning, training.finalReport, training.evaluationInstrument, training.impactReport]
    .filter((item) => item?.exists && item.matchLevel === "DUDOSA")
    .forEach(() => alerts.push({ level: "WARNING", code: "DOUBTFUL_TRAINING_MATCH", message: "La coincidencia del nombre de la capacitación requiere revisión." }));

  return alerts;
}

function buildTrainingReport(planTeacher, trainingRow, snapshot) {
  const reference = trainingReference(trainingRow);
  const agreementMatch = findAgreement(planTeacher, reference.name, snapshot.acuerdos);
  const planningMatch = findCollectiveDocument(reference.name, snapshot.planificaciones);
  const finalMatch = findCollectiveDocument(reference.name, snapshot.informesFinales);
  const instrumentMatch = findCollectiveDocument(reference.name, snapshot.instrumentos);
  const impactMatch = findCollectiveDocument(reference.name, snapshot.impactos);

  const agreement = agreementMatch ? {
    exists: true,
    documentId: text(agreementMatch.record?.id_documento),
    trainingName: pickTrainingName(agreementMatch.record),
    matchLevel: agreementMatch.level,
    matchScore: agreementMatch.score,
    cedulaDocente: pickCedula(agreementMatch.record),
    teacherMatchMethod: agreementMatch.teacherMatch?.method || "",
    record: agreementMatch.record
  } : { exists: false, documentId: "", trainingName: "", matchLevel: "SIN_COINCIDENCIA", matchScore: 0, cedulaDocente: "" };

  const report = {
    id: text(trainingRow?.id) || `${planTeacher.id_documento_plan}|${reference.normalized}`,
    nombre: reference.name,
    nombreNormalizado: reference.normalized,
    datosPlan: trainingRow,
    agreement,
    planning: simpleDocumentCheck(planningMatch),
    finalReport: participantCheck(finalMatch, snapshot.participantesFinales, planTeacher),
    evaluationInstrument: participantCheck(instrumentMatch, snapshot.participantesInstrumentos, planTeacher),
    impactReport: participantCheck(impactMatch, snapshot.participantesImpactos, planTeacher)
  };
  report.alerts = buildAlerts(report);
  report.status = calculateTrainingStatus(report);
  return report;
}

function deriveTeacherCedula(plan, trainingRows, agreements) {
  for (const training of trainingRows) {
    const match = findAgreement(teacherReference(plan), pickTrainingName(training), agreements);
    const cedula = match ? pickCedula(match.record) : "";
    if (cedula) return cedula;
  }
  const nameMatch = findBestTeacherMatch(teacherReference(plan), agreements);
  return nameMatch ? pickCedula(nameMatch.record) : "";
}

function buildTeacherReport(plan, snapshot) {
  const planDocumentId = text(plan?.id_documento);
  const trainingRows = (snapshot.capacitacionesPlan || []).filter((row) => text(row.id_documento) === planDocumentId && pickTrainingName(row));
  const cedula = deriveTeacherCedula(plan, trainingRows, snapshot.acuerdos || []);
  const teacher = teacherReference(plan, cedula);
  const capacitaciones = trainingRows.map((row) => buildTrainingReport(teacher, row, snapshot));

  const report = {
    key: planDocumentId,
    docente: {
      nombre: pickTeacherName(plan),
      nombreNormalizado: normalizeTeacherName(pickTeacherName(plan)),
      cedula: normalizeCedula(cedula),
      carrera: text(plan?.carrera),
      tiempoDedicacion: text(plan?.tiempo_dedicacion)
    },
    planIndividual: {
      exists: Boolean(planDocumentId),
      documentId: planDocumentId,
      codigoDocumento: text(plan?.codigo_documento),
      record: plan
    },
    capacitaciones,
    alerts: []
  };

  if (!capacitaciones.length) {
    report.alerts.push({ level: "ERROR", code: "NO_TRAININGS", message: "El Plan Individual no contiene capacitaciones reconocidas." });
  }
  if (!report.docente.cedula) {
    report.alerts.push({ level: "WARNING", code: "MISSING_TEACHER_ID", message: "No se pudo determinar la cédula del docente desde los acuerdos." });
  }
  capacitaciones.forEach((training) => report.alerts.push(...training.alerts));

  report.evaluation = evaluateReport(report);
  report.estadoGeneral = report.evaluation.state;
  report.puedeGenerar = report.evaluation.canGenerate;
  report.validacionCompleta = report.evaluation.validationComplete;
  return report;
}

function buildAllTeacherReports(snapshot) {
  return (Array.isArray(snapshot?.planes) ? snapshot.planes : [])
    .filter((plan) => text(plan.id_documento) && pickTeacherName(plan))
    .map((plan) => buildTeacherReport(plan, snapshot));
}

module.exports = {
  rowsByDocument,
  participantCheck,
  simpleDocumentCheck,
  buildAlerts,
  buildTrainingReport,
  buildTeacherReport,
  buildAllTeacherReports
};
