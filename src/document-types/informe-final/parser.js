/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/informe-final/parser.js
Función o funciones:
- Extraer los datos variables de Informes Finales de Capacitación.
- Reconocer curso, público, facilitador, fechas, duración, objetivos y cumplimiento.
- Extraer participantes, discapacidad, género y resultados de certificación.
- Construir resumen de certificados, responsables e inconsistencias de páginas.
========================================================= */

"use strict";

const path = require("path");
const {
  normalizeLineBreaks,
  normalizeSpaces,
  normalizeForSearch,
  cleanValue,
  firstMatch,
  parseCodigoDocumento,
  uniqueValues
} = require("../../extractor/normalizer");
const {
  createDocumentId,
  createRowId,
  extractRegistroFromCodigo,
  extractPeriodoFromCodigo
} = require("../../utils/ids");

const DOCUMENT_TYPE = "informe-final";

const MONTHS = Object.freeze({
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12"
});

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cloneRegex(regex, global = false) {
  if (!(regex instanceof RegExp)) return new RegExp(escapeRegex(regex), global ? "ig" : "i");
  let flags = regex.flags;
  if (global && !flags.includes("g")) flags += "g";
  return new RegExp(regex.source, flags);
}

function extractSection(text, startPatterns, endPatterns) {
  const source = normalizeLineBreaks(text);
  const starts = Array.isArray(startPatterns) ? startPatterns : [startPatterns];
  const ends = Array.isArray(endPatterns) ? endPatterns : [endPatterns];

  for (const startPattern of starts) {
    const startRegex = cloneRegex(startPattern, false);
    const startMatch = startRegex.exec(source);
    if (!startMatch) continue;

    const from = startMatch.index + startMatch[0].length;
    let endIndex = source.length;

    for (const endPattern of ends) {
      const endRegex = cloneRegex(endPattern, true);
      endRegex.lastIndex = from;
      const endMatch = endRegex.exec(source);
      if (endMatch && endMatch.index < endIndex) endIndex = endMatch.index;
    }

    return cleanValue(source.slice(from, endIndex));
  }

  return "";
}

function parseSpanishDate(value) {
  const raw = cleanValue(value);
  if (!raw) return "";

  const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (numeric) {
    return `${numeric[3]}-${String(Number(numeric[2])).padStart(2, "0")}-${String(Number(numeric[1])).padStart(2, "0")}`;
  }

  const written = normalizeForSearch(raw).match(/^(\d{1,2})\s*(?:de|-)?\s*([a-z]+)\s*(?:de|-)?\s*(\d{4})$/);
  if (written && MONTHS[written[2]]) {
    return `${written[3]}-${MONTHS[written[2]]}-${String(Number(written[1])).padStart(2, "0")}`;
  }

  return "";
}

function extractTitleData(text) {
  const compact = normalizeSpaces(text);
  const match = compact.match(/Informe Final (?:De|de) La Capacitaci[óo]n\s*:\s*(.+?)\s+Dirigido A\s+(.+?)(?=\s+UNIDAD DE GESTI[ÓO]N|\s+P[ÁA]GINA\s+\d|\s+ELABORADO POR|$)/i);

  if (!match) return { nombre_capacitacion: "", dirigido_a: "", carrera_publico: "" };

  const target = cleanValue(match[2]);
  const career = /todas las carreras/i.test(target)
    ? "Todas las carreras"
    : cleanValue(target.replace(/^La\s+Carrera\s+de\s+/i, "").replace(/^La\s+Carrera\s+/i, ""));

  return {
    nombre_capacitacion: cleanValue(match[1]),
    dirigido_a: target,
    carrera_publico: career
  };
}

function extractDateByLabel(text, labels) {
  const compact = normalizeSpaces(text);

  for (const label of labels || []) {
    const pattern = new RegExp(`${escapeRegex(label)}\\s*:?\\s*(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{4}|\\d{1,2}\\s*(?:de|-)?\\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\\s*(?:de|-)?\\s*\\d{4})`, "i");
    const match = compact.match(pattern);
    if (match) return { texto: cleanValue(match[1]), iso: parseSpanishDate(match[1]) };
  }

  return { texto: "", iso: "" };
}

function extractSignatories(text, context, fileName) {
  const source = normalizeLineBreaks(text);
  const pageTwo = source.search(/1\.\s*NOMBRE DEL\/LOS FACILITADOR/i);
  const cover = normalizeSpaces(pageTwo > 0 ? source.slice(0, pageTwo) : source.slice(0, 6000));
  const roles = [...cover.matchAll(/(ELABORADO POR|REVISADO POR|APROBADO POR)\s*:/gi)]
    .map((match) => match[1].toUpperCase());
  const names = uniqueValues(
    [...cover.matchAll(/NOMBRE\s*:\s*(.+?)(?=\s+NOMBRE\s*:|\s+CARGO\s*:|\s+P[ÁA]GINA|$)/gi)]
      .map((match) => cleanValue(match[1]))
  );
  const cargos = [...cover.matchAll(/CARGO\s*:\s*(.+?)(?=\s+CARGO\s*:|\s+NOMBRE\s*:|\s+P[ÁA]GINA|$)/gi)]
    .map((match) => cleanValue(match[1]));
  const count = Math.max(roles.length, names.length, cargos.length);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const name = names[index] || "";
    const cargo = cargos[index] || "";
    const warnings = [];
    if (!name) warnings.push("No se detectó nombre del responsable.");
    if (!cargo) warnings.push("No se detectó cargo del responsable.");

    rows.push({
      id: createRowId("responsable-informe-final", context.id_documento, index, `${roles[index] || ""}|${name}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_capacitacion: context.nombre_capacitacion,
      rol_responsable: roles[index] || `RESPONSABLE ${index + 1}`,
      nombre_responsable: name,
      cargo_responsable: cargo,
      estado_firma: /firmado|signed/i.test(fileName || "") ? "FIRMADO_SEGUN_ARCHIVO" : (name ? "RESPONSABLE_IDENTIFICADO" : "NO_IDENTIFICADO"),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  }

  return rows;
}

function extractParticipants(text, context) {
  const section = extractSection(text,
    /6\.\s*MATRIZ CON LOS DATOS DE LOS PARTICIPANTES\s*:?/i,
    /7\.\s*CERTIFICADOS A ENTREGAR\s*:?/i
  );
  const compact = normalizeSpaces(section)
    .replace(/N[º°]\s+Nombres y Apellidos\s+C[ée]dula de Identidad\s+Tiene Discapacidad\s+Tipo de Discapacidad\s+Posee Carn[ée] de Discapacidad\s+G[ée]nero/i, " ");
  const regex = /(\d{1,3})\s+(.+?)\s+(\d{8,12}|[A-Z0-9-]{6,20})\s+(S[ií]|No)\s+(.+?)\s+(S[ií]|No)\s+(Masculino|Femenino|Otro|No especificado)(?=\s+\d{1,3}\s+|$)/gi;
  const rows = [];
  let match;

  while ((match = regex.exec(compact)) !== null) {
    const warnings = [];
    const cedula = cleanValue(match[3]);
    if (!/^\d{10}$/.test(cedula)) warnings.push("La identificación no tiene 10 dígitos; revisar si corresponde a persona extranjera.");

    rows.push({
      id: createRowId("participante-informe-final", context.id_documento, rows.length, `${match[1]}|${cedula}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_capacitacion: context.nombre_capacitacion,
      numero_participante: Number(match[1]),
      nombres_apellidos: cleanValue(match[2]),
      cedula_identidad: cedula,
      tiene_discapacidad: cleanValue(match[4]),
      tipo_discapacidad: cleanValue(match[5]),
      posee_carne_discapacidad: cleanValue(match[6]),
      genero: cleanValue(match[7]),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  }

  return rows;
}

function extractCertificateSummary(text, context) {
  const section = normalizeSpaces(extractSection(text,
    /8\.\s*RES[ÚU]MEN ENTREGA DE CERTIFICADOS\s*:?/i,
    [/9\.\s*ANEXO/i, /9\.\s*CONCLUSIONES/i, /ELABORADO POR/i]
  ));
  const numbers = [...section.matchAll(/\b\d+\b/g)].map((match) => Number(match[0]));
  const values = numbers.slice(-6);
  const warnings = [];

  if (values.length < 6) warnings.push("No se detectaron los seis totales del resumen de certificados.");

  return {
    id: createRowId("resumen-informe-final", context.id_documento, 0, context.nombre_capacitacion),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    nombre_capacitacion: context.nombre_capacitacion,
    total_inscritos: values[0] ?? "",
    total_certificado_aprobacion: values[1] ?? "",
    total_certificado_participacion: values[2] ?? "",
    total_certificado_facilitador: values[3] ?? "",
    total_desertores: values[4] ?? "",
    total_reprobados: values[5] ?? "",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function inferUniformOutcome(summary, participantCount) {
  const total = Number(summary.total_inscritos || participantCount || 0);
  const candidates = [
    ["CERTIFICADO_APROBACION", Number(summary.total_certificado_aprobacion || 0)],
    ["CERTIFICADO_PARTICIPACION", Number(summary.total_certificado_participacion || 0)],
    ["CERTIFICADO_FACILITADOR", Number(summary.total_certificado_facilitador || 0)],
    ["DESERTO", Number(summary.total_desertores || 0)],
    ["REPROBO", Number(summary.total_reprobados || 0)]
  ].filter(([, value]) => value === total && total > 0);

  return candidates.length === 1 ? candidates[0][0] : "";
}

function buildResults(participants, summary, context) {
  const uniformOutcome = inferUniformOutcome(summary, participants.length);

  return participants.map((participant, index) => {
    const warnings = [];
    if (!uniformOutcome) warnings.push("No fue posible asignar individualmente la columna marcada; revisar la matriz de certificados.");

    return {
      id: createRowId("resultado-informe-final", context.id_documento, index, participant.cedula_identidad),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_capacitacion: context.nombre_capacitacion,
      numero_participante: participant.numero_participante,
      nombres_apellidos: participant.nombres_apellidos,
      cedula_identidad: participant.cedula_identidad,
      certificado_aprobacion: uniformOutcome === "CERTIFICADO_APROBACION" ? "SI" : (uniformOutcome ? "NO" : ""),
      certificado_participacion: uniformOutcome === "CERTIFICADO_PARTICIPACION" ? "SI" : (uniformOutcome ? "NO" : ""),
      certificado_facilitador: uniformOutcome === "CERTIFICADO_FACILITADOR" ? "SI" : (uniformOutcome ? "NO" : ""),
      reprobo_curso: uniformOutcome === "REPROBO" ? "SI" : (uniformOutcome ? "NO" : ""),
      deserto_curso: uniformOutcome === "DESERTO" ? "SI" : (uniformOutcome ? "NO" : ""),
      resultado_final: uniformOutcome || "REVISAR_DISTRIBUCION",
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    };
  });
}

function extractPageInformation(text, actualPages) {
  const totals = [...normalizeSpaces(text).matchAll(/P[áa]gina\s+\d+\s+(?:de|\|)\s*(\d+)/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const frequencies = new Map();
  totals.forEach((value) => frequencies.set(value, (frequencies.get(value) || 0) + 1));
  const declared = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const variants = uniqueValues(totals.map(String));
  const inconsistent = variants.length > 1 || (declared !== "" && Number(declared) !== Number(actualPages || 0));

  return {
    paginas_declaradas: declared,
    variantes_paginas_declaradas: variants.join(" | "),
    inconsistencia_paginas: inconsistent ? "SI" : "NO"
  };
}

function parseDocument(pdfDocument) {
  const rawText = normalizeLineBreaks(pdfDocument.text || "");
  const fileName = pdfDocument.fileName || path.basename(pdfDocument.filePath || "");
  const codigoDocumento = parseCodigoDocumento(`${rawText} ${fileName}`, "134");
  const idDocumento = createDocumentId(
    pdfDocument.filePath || fileName,
    pdfDocument.index || 0,
    codigoDocumento,
    pdfDocument.fileHash || "",
    DOCUMENT_TYPE
  );
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const title = extractTitleData(rawText);
  const context = {
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    nombre_capacitacion: title.nombre_capacitacion
  };
  const participants = extractParticipants(rawText, context);
  const summary = extractCertificateSummary(rawText, context);
  const results = buildResults(participants, summary, context);
  const responsables = extractSignatories(rawText, context, fileName);
  const pageInfo = extractPageInformation(rawText, pdfDocument.pageCount || 0);
  const startDate = extractDateByLabel(rawText, ["FECHA INICIO", "Fecha inicio"]);
  const endDate = extractDateByLabel(rawText, ["FECHA FINAL", "Fecha final", "FECHA FIN"]);
  const elaborationDate = extractDateByLabel(rawText, ["Fecha de Elaboración"]);
  const facilitator = cleanValue(extractSection(rawText,
    /1\.\s*NOMBRE DEL\/LOS FACILITADOR\/ES\s*:?/i,
    /2\.\s*FECHAS DE IMPARTICI[ÓO]N\s*:?/i
  ));
  const durationText = firstMatch(normalizeSpaces(rawText), [/3\.\s*DURACI[ÓO]N\s*:?\s*(\d+(?:[.,]\d+)?\s*horas?)/i]);
  const durationHours = Number((durationText.match(/[\d.,]+/) || [""])[0].replace(",", ".")) || "";
  const objective = cleanValue(extractSection(rawText,
    /4\.\s*OBJETIVO GENERAL\s*:?/i,
    /5\.\s*CUMPLIMIENTO DE LOS OBJETIVOS DEL CURSO\s*:?/i
  ));
  const fulfillment = cleanValue(extractSection(rawText,
    /5\.\s*CUMPLIMIENTO DE LOS OBJETIVOS DEL CURSO\s*:?/i,
    /6\.\s*MATRIZ CON LOS DATOS DE LOS PARTICIPANTES\s*:?/i
  ));
  const warnings = [];

  if (!codigoDocumento || !/UGPA-INF-\d{1,3}-PRO-134-/i.test(codigoDocumento)) warnings.push("No se detectó un código UGPA-INF de PRO-134 válido.");
  if (!title.nombre_capacitacion) warnings.push("No se detectó nombre de la capacitación.");
  if (!participants.length) warnings.push("No se detectaron participantes.");
  if (summary.total_inscritos !== "" && Number(summary.total_inscritos) !== participants.length) {
    warnings.push(`El resumen declara ${summary.total_inscritos} inscritos, pero se extrajeron ${participants.length} participantes.`);
  }
  if (!responsables.length) warnings.push("No se detectaron responsables.");
  if (pageInfo.inconsistencia_paginas === "SI") warnings.push("Se detectó inconsistencia entre páginas reales y páginas declaradas.");

  const genderCounts = participants.reduce((output, participant) => {
    const key = normalizeForSearch(participant.genero);
    if (key.includes("masculino")) output.masculino += 1;
    else if (key.includes("femenino")) output.femenino += 1;
    else output.otro += 1;
    return output;
  }, { masculino: 0, femenino: 0, otro: 0 });

  const archivo = {
    id: createRowId("archivo-informe-final", idDocumento, 0, fileName),
    id_documento: idDocumento,
    nombre_archivo: fileName,
    ruta_archivo: pdfDocument.filePath || "",
    hash_archivo: pdfDocument.fileHash || "",
    codigo_documento: codigoDocumento,
    numero_registro: extractRegistroFromCodigo(codigoDocumento),
    periodo,
    anio_periodo: periodo.split("-")[0] || "",
    mes_periodo: periodo.split("-")[1] || "",
    version_documento: firstMatch(rawText, [/Versi[óo]n\s*:\s*([^\n]+)/i]),
    fecha_elaboracion_texto: elaborationDate.texto,
    fecha_elaboracion: elaborationDate.iso,
    total_paginas_reales: pdfDocument.pageCount || 0,
    ...pageInfo,
    metodo_extraccion: pdfDocument.extractionMethod || "digital",
    paginas_ocr: pdfDocument.ocrPageCount || 0,
    confianza_ocr: pdfDocument.ocrConfidence || 0,
    estado_extraccion: warnings.length ? "REVISAR" : "OK",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  const datosGenerales = {
    id: createRowId("datos-informe-final", idDocumento, 0, title.nombre_capacitacion),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    nombre_capacitacion: title.nombre_capacitacion,
    dirigido_a: title.dirigido_a,
    carrera_publico: title.carrera_publico,
    facilitador,
    fecha_inicio_texto: startDate.texto,
    fecha_inicio: startDate.iso,
    fecha_fin_texto: endDate.texto,
    fecha_fin: endDate.iso,
    duracion_texto: durationText,
    duracion_horas: durationHours,
    objetivo_general_y_especificos: objective,
    cumplimiento_objetivos: fulfillment,
    total_participantes_extraidos: participants.length,
    total_masculino: genderCounts.masculino,
    total_femenino: genderCounts.femenino,
    total_otro_genero: genderCounts.otro,
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_generales: datosGenerales,
    participantes: participants,
    resultados: results,
    resumen: summary,
    responsables,
    warnings,
    source: {
      file_hash: pdfDocument.fileHash || "",
      extraction_method: pdfDocument.extractionMethod || "digital",
      ocr_pages: pdfDocument.ocrPageCount || 0,
      ocr_confidence: pdfDocument.ocrConfidence || 0,
      text_length: rawText.length
    }
  };
}

function parseDocuments(pdfDocuments) {
  const documents = Array.isArray(pdfDocuments) ? pdfDocuments : [];
  const parsed = [];
  const errors = [];

  documents.forEach((document) => {
    if (!document || !document.ok) {
      errors.push({
        fileName: document ? document.fileName : "",
        errors: document && Array.isArray(document.errors) ? document.errors : ["Documento inválido."]
      });
      return;
    }

    try {
      parsed.push(parseDocument(document));
    } catch (error) {
      errors.push({
        fileName: document.fileName || "",
        errors: [error.message || "No se pudo analizar el Informe Final."]
      });
    }
  });

  return {
    documentType: DOCUMENT_TYPE,
    total: documents.length,
    parsedCount: parsed.length,
    errorCount: errors.length,
    parsed,
    errors
  };
}

module.exports = {
  DOCUMENT_TYPE,
  parseSpanishDate,
  extractSection,
  extractTitleData,
  extractParticipants,
  extractCertificateSummary,
  inferUniformOutcome,
  buildResults,
  extractPageInformation,
  parseDocument,
  parseDocuments
};
