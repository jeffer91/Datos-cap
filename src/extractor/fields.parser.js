/* =========================================================
Nombre completo: fields.parser.js
Ruta o ubicación: /plan-docente-extractor/src/extractor/fields.parser.js
Función o funciones:
- Convertir el texto extraído del PDF en campos variables normalizados.
- Extraer código, periodo, docente, carrera, dedicación y función sustantiva.
- Extraer capacidades docentes, capacitaciones propuestas y formación docente.
- Marcar campos incompletos con advertencias sin bloquear el proceso.
========================================================= */

"use strict";

const path = require("path");
const {
  normalizeSpaces,
  normalizeLineBreaks,
  splitCleanLines,
  cleanValue,
  firstMatch,
  findValueByLabel,
  extractBetween,
  parseCodigoDocumento,
  normalizeDateText,
  uniqueValues
} = require("./normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../utils/ids");

function inferDocenteFromFileName(fileName) {
  const base = path.basename(String(fileName || ""), path.extname(String(fileName || "")));
  const withoutPrefix = base
    .replace(/^UGPA[-_\s]*RGI1[-_\s]*\d+[-_\s]*PRO[-_\s]*251[-_\s]*\d{4}[-_\s]*\d{2}[-_\s]*/i, "")
    .replace(/[-_\s]*signed[-_\s]*firmado.*$/i, "")
    .replace(/\(\d+\)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return withoutPrefix;
}

function extractDocente(text, fileName) {
  const byTitle = firstMatch(text, [
    /DOCENTE:\s*([^\n]+?)\s*CARRERA:/i,
    /DOCENTE:\s*([^\n]+)/i,
    /Nombre\s+Docente\s+([^\n]+)/i
  ]);

  return cleanValue(byTitle || inferDocenteFromFileName(fileName));
}

function extractCarrera(text) {
  return firstMatch(text, [
    /CARRERA:\s*([^\n]+?)(?:\n|FIRMA:|Código:|Codigo:)/i,
    /Carrera\s+([^\n]+)/i
  ]);
}

function extractTiempoDedicacion(text) {
  return firstMatch(text, [
    /Tiempo\s+de\s+Dedicaci[oó]n\s+([^\n]+)/i,
    /Dedicaci[oó]n\s+([^\n]+)/i
  ]);
}

function extractFuncionSustantiva(text) {
  return firstMatch(text, [
    /Funci[oó]n\s+Sustantiva\s+([^\n]+)/i
  ]);
}

function extractAprobador(text) {
  return firstMatch(text, [
    /APROBADO:\s*\n?\s*NOMBRE:\s*([^\n]+)/i,
    /NOMBRE:\s*[^\n]+\s+NOMBRE:\s*([^\n]+)/i
  ]);
}

function extractCargoAprobador(text) {
  return firstMatch(text, [
    /CARGO:\s*DOCENTE\s+CARGO:\s*([^\n]+)/i,
    /Gestor\s+de\s+Procesos\s+Acad[eé]micos/i
  ], 0);
}

function extractCapacidades(text) {
  const section = extractBetween(text, [
    "Capacidades actuales del docente",
    "Evaluación de capacidades actuales",
    "Diagnóstico de capacidades",
    "Capacitaciones Docente"
  ], [
    "Capacitaciones propuestas",
    "Plan de capacitación",
    "Formación Docente",
    "Cronograma"
  ]) || text;

  return {
    curso_actualizacion_ultimos_12_meses: findValueByLabel(section, [
      "curso de actualización",
      "últimos 12 meses",
      "ultimos 12 meses",
      "capacitaciones en los últimos"
    ], { maxLookAhead: 3 }),
    avances_disciplinares_aplicados: findValueByLabel(section, [
      "avances disciplinares",
      "avances recientes",
      "avance aplicado"
    ], { maxLookAhead: 3 }),
    comodidad_metodologias_nuevas: findValueByLabel(section, [
      "comodidad",
      "metodologías nuevas",
      "metodologias nuevas"
    ], { maxLookAhead: 3 }),
    estrategias_pedagogicas: findValueByLabel(section, [
      "estrategias pedagógicas",
      "estrategias pedagogicas",
      "estrategias innovadoras"
    ], { maxLookAhead: 3 }),
    herramientas_tecnologicas: findValueByLabel(section, [
      "herramientas tecnológicas",
      "herramientas tecnologicas",
      "herramientas digitales"
    ], { maxLookAhead: 3 }),
    formacion_adicional_necesaria: findValueByLabel(section, [
      "formación adicional",
      "formacion adicional",
      "formación necesaria",
      "formacion necesaria"
    ], { maxLookAhead: 3 }),
    nivel_academico_actual: findValueByLabel(section, [
      "nivel académico actual",
      "nivel academico actual",
      "título académico",
      "titulo academico"
    ], { maxLookAhead: 3 }),
    tipo_formacion_propuesta: findValueByLabel(section, [
      "tipo de formación",
      "tipo de formacion",
      "formación propuesta",
      "formacion propuesta"
    ], { maxLookAhead: 3 })
  };
}

function extractCapacitaciones(text, context) {
  const compact = normalizeSpaces(text);
  const capacitaciones = [];
  const seen = new Set();

  const datePattern = "(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4})\\s*(?:al|a|hasta|-)\\s*(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4})";
  const regex = new RegExp(`([^.;\\n]{8,140}?)\\s+(\\d{1,3})\\s*(?:horas?)?\\s+${datePattern}\\s*(Aprobaci[oó]n|Aprobado|Pendiente|Revisi[oó]n)?`, "gi");

  let match = regex.exec(compact);

  while (match) {
    const nombre = cleanValue(match[1])
      .replace(/^(Capacitaci[oó]n|Curso|Nombre|Propuesta)\s+/i, "")
      .trim();
    const horas = cleanValue(match[2]);
    const fechaInicio = cleanValue(match[3]);
    const fechaFin = cleanValue(match[4]);
    const tipo = cleanValue(match[5] || "Aprobación");
    const key = `${nombre}|${horas}|${fechaInicio}|${fechaFin}`.toLowerCase();

    if (nombre && !seen.has(key)) {
      seen.add(key);
      capacitaciones.push({
        id: createRowId("capacitacion", context.id_documento, capacitaciones.length, key),
        id_documento: context.id_documento,
        codigo_documento: context.codigo_documento,
        nombre_docente: context.nombre_docente,
        carrera: context.carrera,
        nombre_capacitacion: nombre,
        horas_capacitacion: horas,
        fecha_inicio_capacitacion: fechaInicio,
        fecha_fin_capacitacion: fechaFin,
        fecha_texto_original: normalizeDateText(`${fechaInicio} al ${fechaFin}`),
        tipo_capacitacion: tipo,
        requiere_revision: "NO",
        observacion_extraccion: ""
      });
    }

    match = regex.exec(compact);
  }

  return capacitaciones;
}

function extractFormacionDocente(text, context) {
  const section = extractBetween(text, [
    "Formación Docente",
    "Formacion Docente",
    "Formación académica",
    "Formacion academica"
  ], [
    "Firmas",
    "Conclusiones",
    "Anexos"
  ]) || "";

  const source = section || text;
  const situacionActual = findValueByLabel(source, [
    "situación actual",
    "situacion actual",
    "nivel académico actual",
    "nivel academico actual"
  ], { maxLookAhead: 3 });
  const situacionPropuesta = findValueByLabel(source, [
    "situación propuesta",
    "situacion propuesta",
    "formación propuesta",
    "formacion propuesta"
  ], { maxLookAhead: 3 });
  const tiempoEsperado = findValueByLabel(source, [
    "tiempo esperado",
    "tiempo de cumplimiento",
    "plazo"
  ], { maxLookAhead: 3 });

  const formaciones = [];
  const lines = splitCleanLines(source);
  const candidates = [];

  for (const line of lines) {
    if (/doctorado|maestr[ií]a|diplomado|curso|licenciatura|ingenier[ií]a|tecnolog[ií]a|posgrado/i.test(line)) {
      candidates.push(line);
    }
  }

  const uniqueCandidates = uniqueValues(candidates).slice(0, 8);

  if (uniqueCandidates.length) {
    uniqueCandidates.forEach((item, index) => {
      formaciones.push({
        id: createRowId("formacion", context.id_documento, index, item),
        id_documento: context.id_documento,
        codigo_documento: context.codigo_documento,
        nombre_docente: context.nombre_docente,
        carrera: context.carrera,
        situacion_actual_formacion: situacionActual,
        situacion_propuesta_formacion: situacionPropuesta,
        tiempo_esperado_cumplimiento: tiempoEsperado,
        nombre_formacion: item,
        nivel_academico_formacion: inferNivelAcademico(item),
        tipo_formacion: inferTipoFormacion(item),
        requiere_revision: "NO",
        observacion_extraccion: ""
      });
    });
  } else {
    formaciones.push({
      id: createRowId("formacion", context.id_documento, 0, "sin-detalle"),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      nombre_docente: context.nombre_docente,
      carrera: context.carrera,
      situacion_actual_formacion: situacionActual,
      situacion_propuesta_formacion: situacionPropuesta,
      tiempo_esperado_cumplimiento: tiempoEsperado,
      nombre_formacion: "",
      nivel_academico_formacion: "",
      tipo_formacion: "",
      requiere_revision: "SI",
      observacion_extraccion: "No se detectó detalle de formación docente."
    });
  }

  return formaciones;
}

function inferNivelAcademico(value) {
  const text = normalizeSpaces(value).toLowerCase();

  if (text.includes("doctorado")) return "Doctorado";
  if (text.includes("maestr") || text.includes("magíster") || text.includes("magister")) return "Maestría";
  if (text.includes("diplomado")) return "Diplomado";
  if (text.includes("licenciatura") || text.includes("ingenier")) return "Licenciatura / Ingeniería";
  if (text.includes("tecnolog")) return "Tecnología Superior";
  if (text.includes("posgrado")) return "Posgrado";
  if (text.includes("curso")) return "Curso";

  return "";
}

function inferTipoFormacion(value) {
  const text = normalizeSpaces(value).toLowerCase();

  if (text.includes("genérica") || text.includes("generica")) return "Genérica";
  if (text.includes("específica") || text.includes("especifica")) return "Específica";

  return "";
}

function parsePdfDocument(pdfDocument) {
  const text = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseCodigoDocumento(text) || parseCodigoDocumento(fileName);
  const idDocumento = createDocumentId(pdfDocument.filePath || fileName, pdfDocument.index || 0, codigoDocumento);
  const nombreDocente = extractDocente(text, fileName);
  const carrera = extractCarrera(text);
  const warnings = [];

  if (!codigoDocumento) warnings.push("No se detectó código documental.");
  if (!nombreDocente) warnings.push("No se detectó nombre del docente.");
  if (!carrera) warnings.push("No se detectó carrera.");

  const context = {
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    nombre_docente: nombreDocente,
    carrera
  };

  const archivo = {
    id: createRowId("archivo", idDocumento, 0, fileName),
    id_documento: idDocumento,
    nombre_archivo: fileName,
    ruta_archivo: pdfDocument.filePath || "",
    codigo_documento: codigoDocumento,
    numero_registro: extractRegistroFromCodigo(codigoDocumento),
    periodo: extractPeriodoFromCodigo(codigoDocumento),
    anio_periodo: extractPeriodoFromCodigo(codigoDocumento).split("-")[0] || "",
    mes_periodo: extractPeriodoFromCodigo(codigoDocumento).split("-")[1] || "",
    total_paginas: pdfDocument.pageCount || 0,
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  const identificacion = {
    id: createRowId("identificacion", idDocumento, 0, nombreDocente),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    nombre_docente: nombreDocente,
    tiempo_dedicacion: extractTiempoDedicacion(text),
    carrera,
    funcion_sustantiva: extractFuncionSustantiva(text),
    nombre_firma_docente: nombreDocente,
    nombre_aprobador: extractAprobador(text),
    cargo_aprobador: extractCargoAprobador(text),
    requiere_revision: (!nombreDocente || !carrera) ? "SI" : "NO",
    observacion_extraccion: (!nombreDocente || !carrera) ? "Faltan datos principales de identificación." : ""
  };

  const capacidadesBase = extractCapacidades(text);
  const capacidades = {
    id: createRowId("capacidades", idDocumento, 0, nombreDocente),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    nombre_docente: nombreDocente,
    carrera,
    ...capacidadesBase,
    requiere_revision: Object.values(capacidadesBase).some(Boolean) ? "NO" : "SI",
    observacion_extraccion: Object.values(capacidadesBase).some(Boolean)
      ? ""
      : "No se detectaron respuestas de capacidades docentes."
  };

  return {
    id_documento: idDocumento,
    archivo,
    identificacion,
    capacidades,
    capacitaciones: extractCapacitaciones(text, context),
    formacion: extractFormacionDocente(text, context),
    warnings,
    raw: {
      textLength: text.length,
      firstLines: splitCleanLines(text).slice(0, 20)
    }
  };
}

function parsePdfDocuments(pdfDocuments) {
  const documents = Array.isArray(pdfDocuments) ? pdfDocuments : [];
  const parsed = [];
  const errors = [];

  documents.forEach((document) => {
    if (!document || !document.ok) {
      errors.push({
        fileName: document ? document.fileName : "",
        errors: document ? document.errors : ["Documento inválido."]
      });
      return;
    }

    parsed.push(parsePdfDocument(document));
  });

  return {
    total: documents.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
    parsed,
    errors
  };
}

module.exports = {
  parsePdfDocument,
  parsePdfDocuments,
  inferNivelAcademico,
  inferTipoFormacion
};
