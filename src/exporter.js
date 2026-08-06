"use strict";

const fs = require("fs");
const XLSX = require("xlsx");

function joinList(value) {
  return Array.isArray(value) ? value.join(" | ") : String(value || "");
}

function issueMessages(value) {
  return Object.values(value || {}).map((issue) => issue?.message || "").filter(Boolean).join(" | ");
}

function buildWorkbook(records) {
  const teachers = records.map((item) => ({
    Archivo: item.archivo.nombre,
    Docente: item.docente.nombre,
    Carrera: item.docente.carrera,
    "Tiempo de dedicación": item.docente.tiempo_dedicacion,
    "Nivel académico actual": item.docente.nivel_academico_actual,
    "Código del documento": item.docente.codigo_documento,
    "Periodo del plan": item.docente.periodo_plan,
    Plantilla: item.deteccion?.plantilla || "",
    "Método de lectura": item.archivo.metodo_lectura,
    "Motores ejecutados": joinList(item.archivo.motores_lectura || item.deteccion?.motores_ejecutados),
    Estado: item.estado,
    "Estado detallado": item.estado_detallado || item.estado,
    Confianza: item.confianza,
    "Errores bloqueantes": issueMessages(item.problemas_campos),
    Advertencias: issueMessages(item.advertencias_campos),
    "Campos faltantes": joinList(item.campos_faltantes)
  }));

  const diagnoses = records.map((item) => ({
    "Código del documento": item.docente.codigo_documento,
    Docente: item.docente.nombre,
    "Capacitación últimos 12 meses": item.diagnostico.capacitacion_12_meses,
    "Avances aplicados": item.diagnostico.avances_aplicados,
    "Comodidad con metodologías": item.diagnostico.comodidad_metodologias,
    "Estrategias pedagógicas": item.diagnostico.estrategias_pedagogicas,
    "Herramientas tecnológicas": item.diagnostico.herramientas_tecnologicas,
    "Formación adicional": item.diagnostico.formacion_adicional,
    "Tipo de formación": item.diagnostico.tipo_formacion
  }));

  const trainings = records.flatMap((item) => (item.capacitaciones || []).map((training) => ({
    "Código del documento": item.docente.codigo_documento,
    Docente: item.docente.nombre,
    "Nombre de capacitación": training.nombre,
    Horas: training.horas,
    "Fecha inicio": training.fecha_inicio_propuesta,
    "Fecha fin": training.fecha_fin_propuesta,
    "Fecha original": training.fecha_rango_original,
    Tipo: training.tipo,
    "Actividades teóricas": joinList(training.actividades_teoricas),
    "Actividades prácticas": joinList(training.actividades_practicas),
    "Impacto esperado": training.impacto_esperado,
    "Visión a largo plazo": training.vision_largo_plazo,
    "Detalle compartido": training.detalle_compartido_entre_capacitaciones ? "Sí" : "No",
    "Origen de extracción": training.origen_extraccion || ""
  })));

  const validations = records.flatMap((item) => Object.entries(item.validaciones || {}).map(([layer, result]) => ({
    "Código del documento": item.docente.codigo_documento,
    Docente: item.docente.nombre,
    Capa: layer,
    Resultado: result?.ok ? "Correcto" : "Revisar",
    Errores: Number(result?.errores || 0),
    Advertencias: Number(result?.advertencias || 0)
  })));

  const engines = records.flatMap((item) => (item.motores || []).map((engine) => ({
    "Código del documento": item.docente.codigo_documento,
    Docente: item.docente.nombre,
    Motor: engine.nombre,
    Método: engine.metodo,
    "Problemas detectados": engine.problemas,
    "Capacitaciones detectadas": engine.capacitaciones
  })));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(teachers), "Docentes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(diagnoses), "Diagnóstico");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trainings), "Capacitaciones");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(validations), "Validaciones");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(engines), "Motores");
  return workbook;
}

function exportExcel(records, filePath) {
  const workbook = buildWorkbook(records);
  XLSX.writeFile(workbook, filePath);
  return filePath;
}

function exportJson(records, filePath) {
  fs.writeFileSync(filePath, `${JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)}\n`, "utf8");
  return filePath;
}

module.exports = { buildWorkbook, exportExcel, exportJson };
