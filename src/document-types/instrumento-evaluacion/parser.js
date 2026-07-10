/* =========================================================
Nombre completo: parser.js
Ruta o ubicación: /src/document-types/instrumento-evaluacion/parser.js
Función o funciones:
- Extraer datos generales de instrumentos de evaluación PRO-135.
- Extraer participantes, indicadores cuantitativos, escala Likert y objetivos.
- Conservar conclusiones, recomendaciones, responsables y trazabilidad.
- Marcar para revisión los datos cuya columna no pueda determinarse con seguridad.
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

const DOCUMENT_TYPE = "instrumento-evaluacion";

const MONTHS = Object.freeze({
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12"
});

const LIKERT_ITEMS = Object.freeze([
  "Claridad de los Contenidos",
  "Relevancia del Material",
  "Metodología Utilizada",
  "Interacción del Facilitador",
  "Satisfacción General"
]);

const OBJECTIVE_NAMES = Object.freeze([
  "Comprender los Conceptos Clave del Tema",
  "Aplicar Conocimientos en Casos Prácticos",
  "Desarrollar Habilidades de Presentación"
]);

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

  const numeric = raw.match(/^(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{4})$/);
  if (numeric) {
    return `${numeric[3]}-${String(Number(numeric[2])).padStart(2, "0")}-${String(Number(numeric[1])).padStart(2, "0")}`;
  }

  const written = normalizeForSearch(raw).match(/^(\d{1,2})\s*(?:de|-)?\s*([a-z]+)\s*(?:de|-)?\s*(\d{4})$/);
  if (written && MONTHS[written[2]]) {
    return `${written[3]}-${MONTHS[written[2]]}-${String(Number(written[1])).padStart(2, "0")}`;
  }

  return "";
}

function extractHeaderData(text) {
  const compact = normalizeSpaces(text);
  const match = compact.match(/Instrumento de evaluaci[óo]n de la capacitaci[óo]n\s*:\s*(.+?)(?:,?\s+Dirigido A\s+(.+?))?(?=\s+UNIDAD DE GESTI[ÓO]N|\s+C[óo]digo\s*:|\s+P[áa]gina\s+\d|\s+ELABORADO POR|$)/i);
  const course = match ? cleanValue(match[1]) : "";
  const target = match ? cleanValue(match[2] || "") : "";
  const career = /todas las carreras/i.test(target)
    ? "Todas las carreras"
    : cleanValue(target.replace(/^La\s+Carrera\s+de\s+/i, "").replace(/^La\s+Carrera\s+/i, ""));

  return {
    nombre_curso: course,
    dirigido_a: target,
    carrera_publico: career
  };
}

function extractGeneralData(text) {
  const header = extractHeaderData(text);
  const compact = normalizeSpaces(text);
  const course = firstMatch(compact, [
    /NOMBRE DEL CURSO\s*:\s*(.+?)(?=\s+PER[ÍI]ODO DE LA CAPACITACI[ÓO]N)/i
  ]) || header.nombre_curso;
  const trainingPeriod = firstMatch(compact, [
    /PER[ÍI]ODO DE LA CAPACITACI[ÓO]N\s*:\s*(.+?)(?=\s+NOMBRE DEL\/LOS FACILITADOR)/i
  ]);
  const facilitator = firstMatch(compact, [
    /NOMBRE DEL\/LOS FACILITADOR\(ES\)\s*:\s*(.+?)(?=\s+FECHA DE ELABORACI[ÓO]N)/i,
    /NOMBRE DEL\/LOS FACILITADOR\/ES\s*:\s*(.+?)(?=\s+FECHA DE ELABORACI[ÓO]N)/i
  ]);
  const dateText = firstMatch(compact, [
    /FECHA DE ELABORACI[ÓO]N\s*:?\s*(\d{1,2}\s*(?:de|-)?\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s*(?:de|-)?\s*\d{4}|\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{4})/i
  ]);

  return {
    nombre_curso: cleanValue(course),
    periodo_capacitacion_texto: cleanValue(trainingPeriod),
    facilitador: cleanValue(facilitator),
    fecha_elaboracion_texto: cleanValue(dateText),
    fecha_elaboracion: parseSpanishDate(dateText),
    dirigido_a: header.dirigido_a,
    carrera_publico: header.carrera_publico
  };
}

function cleanParticipantSection(section) {
  return normalizeSpaces(section)
    .replace(/#|N[º°]/g, " ")
    .replace(/Nombres y Apellidos/gi, " ")
    .replace(/C[ée]dula de Identidad/gi, " ")
    .replace(/Tiene discapacidad/gi, " ")
    .replace(/Tipo de discapacidad/gi, " ")
    .replace(/posee carn[ée] de discapacidad/gi, " ")
    .replace(/G[ée]nero/gi, " ")
    .replace(/SI\s+NO\s+SI\s+NO/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferParticipantFlags(tail) {
  const compact = normalizeSpaces(tail);
  const xCount = (compact.match(/\bX\b/gi) || []).length;
  const explicitDisability = compact.match(/\b(S[ií]|No)\b/i);
  const typeText = cleanValue(compact.replace(/\bX\b/gi, " ").replace(/\b(S[ií]|No)\b/gi, " "));

  if (explicitDisability) {
    return {
      tiene_discapacidad: /^s/i.test(explicitDisability[1]) ? "SI" : "NO",
      tipo_discapacidad: typeText,
      posee_carne_discapacidad: "",
      requiere_revision: "SI",
      observacion: "La estructura de las marcas de discapacidad requiere revisión visual."
    };
  }

  if (xCount === 2 && !typeText) {
    return {
      tiene_discapacidad: "NO",
      tipo_discapacidad: "Ninguna",
      posee_carne_discapacidad: "NO",
      requiere_revision: "NO",
      observacion: ""
    };
  }

  return {
    tiene_discapacidad: "",
    tipo_discapacidad: typeText,
    posee_carne_discapacidad: "",
    requiere_revision: "SI",
    observacion: "No fue posible determinar con seguridad las columnas de discapacidad y carné."
  };
}

function normalizeGender(value) {
  const gender = normalizeForSearch(value);
  if (gender === "m" || gender.includes("masculino")) return "Masculino";
  if (gender === "f" || gender.includes("femenino")) return "Femenino";
  return cleanValue(value);
}

function extractParticipants(text, context) {
  const section = extractSection(text,
    /2\.\s*MATRIZ CON LOS DATOS DE LOS PARTICIPANTES\s*:?/i,
    /3\.\s*RESULTADOS DE EVALUACI[ÓO]N\s*:?/i
  );
  const compact = cleanParticipantSection(section);
  const regex = /(\d{1,3})\s+(.+?)\s+(\d{8,12}|[A-Z0-9-]{6,20})\s+(.+?)\s+(Masculino|Femenino|M|F)(?=\s+\d{1,3}\s+|$)/gi;
  const rows = [];
  let match;

  while ((match = regex.exec(compact)) !== null) {
    const flags = inferParticipantFlags(match[4]);
    const identification = cleanValue(match[3]);
    const warnings = [];
    if (!/^\d{10}$/.test(identification)) {
      warnings.push("La identificación no tiene 10 dígitos; revisar si corresponde a una persona extranjera.");
    }
    if (flags.observacion) warnings.push(flags.observacion);

    rows.push({
      id: createRowId("participante-instrumento", context.id_documento, rows.length, `${match[1]}|${identification}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      numero_participante: Number(match[1]),
      nombres_apellidos: cleanValue(match[2]),
      cedula_identidad: identification,
      tiene_discapacidad: flags.tiene_discapacidad,
      tipo_discapacidad: flags.tipo_discapacidad,
      posee_carne_discapacidad: flags.posee_carne_discapacidad,
      genero: normalizeGender(match[5]),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  }

  return rows;
}

function extractMetric(text, definition, context, index) {
  const compact = normalizeSpaces(text);
  const match = compact.match(definition.regex);
  const warnings = [];

  if (!match) {
    warnings.push("No se detectó el resultado del indicador.");
  }

  return {
    id: createRowId("indicador-instrumento", context.id_documento, index, definition.criterio),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    nombre_curso: context.nombre_curso,
    grupo_indicador: definition.grupo,
    criterio: definition.criterio,
    indicador: definition.indicador,
    resultado_texto: match ? cleanValue(match[1]) : "",
    resultado_numerico: match ? Number(String(match[1]).replace(/[^0-9.,-]/g, "").replace(",", ".")) : "",
    unidad_resultado: definition.unidad,
    observaciones: match ? cleanValue(match[2] || "") : "",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function extractIndicators(text, context) {
  const section = extractSection(text,
    /3\.\s*RESULTADOS DE EVALUACI[ÓO]N\s*:?/i,
    [/B\.\s*EVALUACI[ÓO]N CUALITATIVA CON ESCALA DE LIKERT/i, /EVALUACI[ÓO]N CUALITATIVA CON ESCALA DE LIKERT/i]
  );
  const definitions = [
    {
      grupo: "Uso de recursos y metodología",
      criterio: "Cumplimiento del Cronograma",
      indicador: "Porcentaje de sesiones realizadas según el plan",
      unidad: "%",
      regex: /Cumplimiento del Cronograma\s+Porcentaje de sesiones realizadas seg[úu]n el plan\s+([0-9]+(?:[.,][0-9]+)?\s*%?)\s*(.*?)(?=Participaci[óo]n Activa)/i
    },
    {
      grupo: "Uso de recursos y metodología",
      criterio: "Participación Activa",
      indicador: "Número de participantes activos",
      unidad: "participantes",
      regex: /Participaci[óo]n Activa\s+N[úu]mero de participantes activos\s+([0-9]+(?:[.,][0-9]+)?)\s*(.*?)(?=Uso de Recursos Tecnol[óo]gicos)/i
    },
    {
      grupo: "Uso de recursos y metodología",
      criterio: "Uso de Recursos Tecnológicos",
      indicador: "Porcentaje de recursos utilizados eficientemente",
      unidad: "%",
      regex: /Uso de Recursos Tecnol[óo]gicos\s+Porcentaje de recursos utilizados eficientemente\s+([0-9]+(?:[.,][0-9]+)?\s*%?)\s*(.*?)(?=Aplicaci[óo]n de la Metodolog[ií]a)/i
    },
    {
      grupo: "Uso de recursos y metodología",
      criterio: "Aplicación de la Metodología",
      indicador: "Número de actividades ejecutadas con la metodología planeada",
      unidad: "actividades",
      regex: /Aplicaci[óo]n de la Metodolog[ií]a\s+N[úu]mero de actividades ejecutadas con la metodolog[ií]a planeada\s+([0-9]+(?:[.,][0-9]+)?)\s*(.*?)(?=Adaptabilidad del Facilitador)/i
    },
    {
      grupo: "Uso de recursos y metodología",
      criterio: "Adaptabilidad del Facilitador",
      indicador: "Número de ajustes realizados por el facilitador",
      unidad: "ajustes",
      regex: /Adaptabilidad del Facilitador\s+N[úu]mero de ajustes realizados por el facilitador\s+([0-9]+(?:[.,][0-9]+)?)\s*(.*?)(?=B\.\s*Evaluaci[óo]n de Resultados Cuantitativos)/i
    },
    {
      grupo: "Resultados cuantitativos",
      criterio: "Evaluación del Aprendizaje",
      indicador: "Promedio de calificaciones obtenidas",
      unidad: "calificación",
      regex: /Evaluaci[óo]n del Aprendizaje\s+Promedio de calificaciones obtenidas\s+([0-9]+(?:[.,][0-9]+)?(?:\s*\/\s*[0-9]+)?)\s*(.*?)(?=Satisfacci[óo]n de Participantes)/i
    },
    {
      grupo: "Resultados cuantitativos",
      criterio: "Satisfacción de Participantes",
      indicador: "Número de participantes satisfechos",
      unidad: "participantes",
      regex: /Satisfacci[óo]n de Participantes\s+N[úu]mero de participantes satisfechos\s+([0-9]+(?:[.,][0-9]+)?)\s*(.*?)(?=Resultados Finales)/i
    },
    {
      grupo: "Resultados cuantitativos",
      criterio: "Resultados Finales",
      indicador: "Tasa de aprobación",
      unidad: "%",
      regex: /Resultados Finales\s+Tasa de aprobaci[óo]n\s+([0-9]+(?:[.,][0-9]+)?\s*%?)\s*(.*?)(?=Aplicabilidad de Conocimientos)/i
    },
    {
      grupo: "Resultados cuantitativos",
      criterio: "Aplicabilidad de Conocimientos",
      indicador: "Porcentaje de participantes que aplican lo aprendido",
      unidad: "%",
      regex: /Aplicabilidad de Conocimientos\s+Porcentaje de participantes que aplican lo aprendido\s+([0-9]+(?:[.,][0-9]+)?\s*%?)\s*(.*?)(?=Seguimiento Post.?Curso)/i
    },
    {
      grupo: "Resultados cuantitativos",
      criterio: "Seguimiento Post-Curso",
      indicador: "Número de participantes que han recibido seguimiento",
      unidad: "participantes",
      regex: /Seguimiento Post.?Curso\s+N[úu]mero de participantes que han recibido seguimiento\s+([0-9]+(?:[.,][0-9]+)?)\s*(.*?)(?=B\.\s*Evaluaci[óo]n Cualitativa|Evaluaci[óo]n Cualitativa)/i
    }
  ];

  return definitions.map((definition, index) => extractMetric(section, definition, context, index));
}

function findLikertScale(segment) {
  const normalized = normalizeForSearch(segment);
  const scales = [
    ["Muy en desacuerdo", "MUY_EN_DESACUERDO"],
    ["En desacuerdo", "EN_DESACUERDO"],
    ["Neutral", "NEUTRAL"],
    ["Muy de acuerdo", "MUY_DE_ACUERDO"],
    ["De acuerdo", "DE_ACUERDO"]
  ];

  for (const [label, code] of scales) {
    if (normalized.includes(normalizeForSearch(label))) return { label, code };
  }

  return null;
}

function extractLikert(text, context) {
  const section = extractSection(text,
    [/B\.\s*EVALUACI[ÓO]N CUALITATIVA CON ESCALA DE LIKERT/i, /EVALUACI[ÓO]N CUALITATIVA CON ESCALA DE LIKERT/i],
    /C\.\s*CUMPLIMIENTO DE LOS OBJETIVOS DE APRENDIZAJE/i
  );
  const compact = normalizeSpaces(section);

  return LIKERT_ITEMS.map((item, index) => {
    const start = normalizeForSearch(compact).indexOf(normalizeForSearch(item));
    const nextItem = LIKERT_ITEMS[index + 1];
    const next = nextItem ? normalizeForSearch(compact).indexOf(normalizeForSearch(nextItem), start + 1) : compact.length;
    const segment = start >= 0 ? compact.slice(start + item.length, next >= 0 ? next : compact.length) : "";
    const scale = findLikertScale(segment);
    const hasMark = /\bX\b|☒|✓|✔/i.test(segment) || (start >= 0 && /\bX\b/i.test(compact.slice(start, start + item.length + 30)));
    const warnings = [];

    if (start < 0) warnings.push("No se detectó el ítem en el documento.");
    else if (hasMark && !scale) warnings.push("Se detectó una marca, pero el texto del PDF no conserva la columna Likert.");
    else if (!hasMark) warnings.push("No se detectó una marca para el ítem.");

    return {
      id: createRowId("likert-instrumento", context.id_documento, index, item),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      item_evaluado: item,
      marca_detectada: hasMark ? "SI" : "NO",
      escala_likert: scale ? scale.label : "",
      codigo_escala: scale ? scale.code : (hasMark ? "MARCA_SIN_COLUMNA" : ""),
      evidencia_texto: cleanValue(segment),
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    };
  });
}

function extractObjectives(text, context) {
  const section = extractSection(text,
    /C\.\s*CUMPLIMIENTO DE LOS OBJETIVOS DE APRENDIZAJE[^\n]*\n?/i,
    [/D\.\s*/i, /4\.\s*(?:CONCLUSIONES|OBSERVACIONES)/i, /CONCLUSIONES\s*:?/i]
  );
  const compact = normalizeSpaces(section);
  const normalized = normalizeForSearch(compact);
  const rows = [];

  OBJECTIVE_NAMES.forEach((objective, index) => {
    const start = normalized.indexOf(normalizeForSearch(objective));
    if (start < 0) return;
    const nextName = OBJECTIVE_NAMES[index + 1];
    const next = nextName ? normalized.indexOf(normalizeForSearch(nextName), start + 1) : compact.length;
    const segment = compact.slice(start + objective.length, next >= 0 ? next : compact.length);
    const percentage = segment.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
    const observation = percentage
      ? cleanValue(segment.slice((percentage.index || 0) + percentage[0].length))
      : cleanValue(segment);
    const warnings = [];
    if (!percentage) warnings.push("No se detectó porcentaje de cumplimiento.");

    rows.push({
      id: createRowId("objetivo-instrumento", context.id_documento, rows.length, objective),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
      numero_objetivo: rows.length + 1,
      objetivo_aprendizaje: objective,
      porcentaje_cumplido: percentage ? Number(percentage[1].replace(",", ".")) : "",
      observaciones: observation,
      requiere_revision: warnings.length ? "SI" : "NO",
      observacion_extraccion: warnings.join(" | ")
    });
  });

  return rows;
}

function extractAnalysis(text, context) {
  const qualitative = extractSection(text,
    [/EVALUACI[ÓO]N DE RESULTADOS CUALITATIVOS\s*:?/i, /RESULTADOS CUALITATIVOS\s*:?/i],
    [/OBSERVACIONES GENERALES\s*:?/i, /CONCLUSIONES\s*:?/i, /RECOMENDACIONES\s*:?/i]
  );
  const observations = extractSection(text,
    /OBSERVACIONES GENERALES\s*:?/i,
    [/CONCLUSIONES\s*:?/i, /RECOMENDACIONES\s*:?/i]
  );
  const conclusions = extractSection(text,
    /CONCLUSIONES\s*:?/i,
    [/RECOMENDACIONES\s*:?/i, /ANEXOS?\s*:?/i, /ELABORADO POR\s*:?/i]
  );
  const recommendations = extractSection(text,
    /RECOMENDACIONES\s*:?/i,
    [/ANEXOS?\s*:?/i, /ELABORADO POR\s*:?/i]
  );
  const warnings = [];

  if (!qualitative && !observations && !conclusions && !recommendations) {
    warnings.push("No se detectaron secciones narrativas finales.");
  }

  return {
    id: createRowId("analisis-instrumento", context.id_documento, 0, context.nombre_curso),
    id_documento: context.id_documento,
    codigo_documento: context.codigo_documento,
    periodo: context.periodo,
    nombre_curso: context.nombre_curso,
    resultados_cualitativos: cleanValue(qualitative),
    observaciones_generales: cleanValue(observations),
    conclusiones: cleanValue(conclusions),
    recomendaciones: cleanValue(recommendations),
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };
}

function extractSignatories(text, context, fileName) {
  const source = normalizeLineBreaks(text);
  const dataIndex = source.search(/1\.\s*Datos Generales/i);
  const cover = normalizeSpaces(dataIndex > 0 ? source.slice(0, dataIndex) : source.slice(0, 6000));
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
      id: createRowId("responsable-instrumento", context.id_documento, index, `${roles[index] || ""}|${name}`),
      id_documento: context.id_documento,
      codigo_documento: context.codigo_documento,
      periodo: context.periodo,
      nombre_curso: context.nombre_curso,
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
  const codigoDocumento = parseCodigoDocumento(`${rawText} ${fileName}`, "135");
  const idDocumento = createDocumentId(
    pdfDocument.filePath || fileName,
    pdfDocument.index || 0,
    codigoDocumento,
    pdfDocument.fileHash || "",
    DOCUMENT_TYPE
  );
  const periodo = extractPeriodoFromCodigo(codigoDocumento);
  const general = extractGeneralData(rawText);
  const context = {
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    nombre_curso: general.nombre_curso
  };
  const participantes = extractParticipants(rawText, context);
  const indicadores = extractIndicators(rawText, context);
  const likert = extractLikert(rawText, context);
  const objetivos = extractObjectives(rawText, context);
  const analisis = extractAnalysis(rawText, context);
  const responsables = extractSignatories(rawText, context, fileName);
  const pageInfo = extractPageInformation(rawText, pdfDocument.pageCount || 0);
  const warnings = [];

  if (!codigoDocumento || !/UGPA-RGI1-\d{1,3}-PRO-135-/i.test(codigoDocumento)) warnings.push("No se detectó un código UGPA-RGI1 de PRO-135 válido.");
  if (!general.nombre_curso) warnings.push("No se detectó nombre del curso.");
  if (!general.facilitador) warnings.push("No se detectó facilitador.");
  if (!participantes.length) warnings.push("No se detectaron participantes.");
  if (!indicadores.some((row) => row.resultado_texto)) warnings.push("No se detectaron resultados cuantitativos.");
  if (!objetivos.length) warnings.push("No se detectaron objetivos de aprendizaje.");
  if (!responsables.length) warnings.push("No se detectaron responsables.");
  if (pageInfo.inconsistencia_paginas === "SI") warnings.push("Se detectó inconsistencia entre páginas reales y declaradas.");

  const genders = participantes.reduce((output, participant) => {
    const gender = normalizeForSearch(participant.genero);
    if (gender.includes("masculino")) output.masculino += 1;
    else if (gender.includes("femenino")) output.femenino += 1;
    else output.otro += 1;
    return output;
  }, { masculino: 0, femenino: 0, otro: 0 });

  const archivo = {
    id: createRowId("archivo-instrumento", idDocumento, 0, fileName),
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
    fecha_elaboracion_texto: general.fecha_elaboracion_texto,
    fecha_elaboracion: general.fecha_elaboracion,
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
    id: createRowId("datos-instrumento", idDocumento, 0, general.nombre_curso),
    id_documento: idDocumento,
    codigo_documento: codigoDocumento,
    periodo,
    nombre_curso: general.nombre_curso,
    periodo_capacitacion_texto: general.periodo_capacitacion_texto,
    facilitador: general.facilitador,
    fecha_elaboracion_texto: general.fecha_elaboracion_texto,
    fecha_elaboracion: general.fecha_elaboracion,
    dirigido_a: general.dirigido_a,
    carrera_publico: general.carrera_publico,
    total_participantes: participantes.length,
    total_masculino: genders.masculino,
    total_femenino: genders.femenino,
    total_otro_genero: genders.otro,
    total_indicadores: indicadores.length,
    indicadores_con_resultado: indicadores.filter((row) => row.resultado_texto !== "").length,
    total_objetivos: objetivos.length,
    promedio_cumplimiento_objetivos: objetivos.length
      ? Number((objetivos.reduce((sum, row) => sum + Number(row.porcentaje_cumplido || 0), 0) / objetivos.length).toFixed(2))
      : "",
    requiere_revision: warnings.length ? "SI" : "NO",
    observacion_extraccion: warnings.join(" | ")
  };

  return {
    document_type: DOCUMENT_TYPE,
    id_documento: idDocumento,
    archivo,
    datos_generales: datosGenerales,
    participantes,
    indicadores,
    likert,
    objetivos,
    analisis,
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
        errors: [error.message || "No se pudo analizar el Instrumento de Evaluación."]
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
  LIKERT_ITEMS,
  OBJECTIVE_NAMES,
  parseSpanishDate,
  extractSection,
  extractHeaderData,
  extractGeneralData,
  inferParticipantFlags,
  extractParticipants,
  extractIndicators,
  extractLikert,
  extractObjectives,
  extractAnalysis,
  extractPageInformation,
  parseDocument,
  parseDocuments
};
