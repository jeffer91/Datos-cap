"use strict";

const fs = require("fs");
const XLSX = require("xlsx");

function yesNo(value) {
  return value ? "Sí" : "No";
}

function buildAgreementWorkbook(records) {
  const rows = (Array.isArray(records) ? records : []).map((item) => ({
    "Código único del acuerdo": item.acuerdo?.codigo || "",
    "Fecha de suscripción": item.acuerdo?.fecha_suscripcion || "",
    Periodo: item.acuerdo?.periodo || "",
    "Versión de la plantilla": item.acuerdo?.version_plantilla || "",
    "Estado del acuerdo": item.acuerdo?.estado_acuerdo || "",
    "Archivo PDF final": item.acuerdo?.archivo_pdf_final || item.archivo?.ruta || "",
    "ID o cédula del docente": item.docente?.cedula || "",
    "Nombre completo": item.docente?.nombre || "",
    Carrera: item.docente?.carrera || "",
    Cargo: item.docente?.cargo || "",
    "ID de la capacitación del plan": item.capacitacion?.id_plan || "",
    "Nombre de la capacitación": item.capacitacion?.nombre || "",
    "Financiamiento total": yesNo(item.patrocinio?.financiamiento_total),
    "Financiamiento parcial": yesNo(item.patrocinio?.financiamiento_parcial),
    "Porcentaje financiado": item.patrocinio?.porcentaje_financiado || "",
    "Anticipo de sueldo u honorarios": yesNo(item.patrocinio?.anticipo_sueldo_honorarios),
    "Cambio temporal de modalidad de trabajo": yesNo(item.patrocinio?.cambio_modalidad_trabajo),
    "Licencia con remuneración": yesNo(item.patrocinio?.licencia_remunerada),
    "Licencia sin remuneración": yesNo(item.patrocinio?.licencia_no_remunerada),
    "Ajuste de horario laboral": yesNo(item.patrocinio?.ajuste_horario_laboral),
    "Método de lectura": item.archivo?.metodo_lectura || "",
    "Estado de extracción": item.estado || "",
    "Campos faltantes": (item.campos_faltantes || []).join(" | ")
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 34 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 46 },
    { wch: 18 }, { wch: 32 }, { wch: 30 }, { wch: 18 }, { wch: 38 }, { wch: 42 },
    { wch: 18 }, { wch: 19 }, { wch: 20 }, { wch: 24 }, { wch: 30 }, { wch: 23 },
    { wch: 23 }, { wch: 24 }, { wch: 16 }, { wch: 18 }, { wch: 50 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Acuerdos");
  return workbook;
}

function exportAgreementExcel(records, filePath) {
  XLSX.writeFile(buildAgreementWorkbook(records), filePath);
  return filePath;
}

function exportAgreementJson(records, filePath) {
  fs.writeFileSync(filePath, `${JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)}\n`, "utf8");
  return filePath;
}

module.exports = {
  buildAgreementWorkbook,
  exportAgreementExcel,
  exportAgreementJson
};
