"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { PlanStorage } = require("../src/storage");
const { AgreementStorage } = require("../src/agreement-storage");

function planTraining(name = "Capacitación corregida") {
  return [{
    nombre: name,
    horas: 40,
    fecha_inicio_propuesta: "octubre de 2025",
    fecha_fin_propuesta: "noviembre de 2025",
    tipo: "Aprobación",
    actividades_teoricas: ["Fundamentos"],
    actividades_practicas: ["Prácticas"],
    impacto_esperado: "Impacto",
    vision_largo_plazo: "Visión"
  }];
}

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-storage-"));

  try {
    const planStorage = new PlanStorage(path.join(root, "planes"));
    planStorage.upsertMany([{
      id: "plan-manual",
      archivo: { nombre: "plan-anterior.pdf", hash: "hash-anterior", ruta: "C:/anterior/plan.pdf", fecha_procesamiento: "2026-08-05T10:00:00.000Z" },
      docente: {
        codigo_documento: "UGPA-RGI2-07-PRO-251-2024-10",
        periodo_plan: "2024-10",
        nombre: "Docente corregido",
        carrera: "Desarrollo de Software"
      },
      diagnostico: { tipo_formacion: "Específica" },
      capacitaciones: planTraining(),
      estado: "REVISAR",
      confianza: 88,
      campos_faltantes: ["Periodo del plan"],
      problemas_campos: {
        "docente.periodo_plan": { message: "Falta completar: Periodo del plan." }
      },
      deteccion: { confirmado_manualmente: true, posible_plan: true },
      correccion_manual: true,
      fecha_correccion: "2026-08-05T10:00:00.000Z",
      advertencias: ["Revisión anterior"]
    }]);

    planStorage.upsertMany([{
      id: "plan-ocr-nuevo",
      archivo: { nombre: "plan-nuevo.pdf", hash: "hash-nuevo", ruta: "C:/nuevo/plan.pdf", fecha_procesamiento: "2026-08-05T11:00:00.000Z" },
      docente: {
        codigo_documento: "UGPA-RGI2-07-PRO-251-2024-10",
        periodo_plan: "2024-10",
        nombre: "Texto OCR incorrecto",
        carrera: "Desarrollo de Software"
      },
      diagnostico: {},
      capacitaciones: [],
      estado: "COMPLETO",
      confianza: 100,
      campos_faltantes: [],
      problemas_campos: {},
      deteccion: { confirmado_manualmente: false },
      correccion_manual: false,
      advertencias: ["OCR nuevo"]
    }]);

    const preservedPlan = planStorage.list()[0];
    assert.strictEqual(planStorage.list().length, 1);
    assert.strictEqual(preservedPlan.id, "plan-manual");
    assert.strictEqual(preservedPlan.docente.nombre, "Docente corregido");
    assert.strictEqual(preservedPlan.archivo.ruta, "C:/nuevo/plan.pdf");
    assert.ok(preservedPlan.problemas_campos["docente.periodo_plan"]);
    assert.strictEqual(preservedPlan.deteccion.confirmado_manualmente, true);

    const duplicateStorage = new PlanStorage(path.join(root, "duplicados"));
    duplicateStorage.upsertMany([{
      id: "plan-codigo",
      archivo: { nombre: "plan-codigo.pdf", hash: "hash-codigo", ruta: "C:/planes/plan-codigo.pdf", fecha_procesamiento: "2026-08-05T09:00:00.000Z" },
      docente: {
        codigo_documento: "UGPA-RGI1-50-PRO-251-2025-10",
        periodo_plan: "2025-10",
        nombre: "Luis Miguel Lincango Cabezas",
        carrera: "Mecánica Automotriz"
      },
      diagnostico: {},
      capacitaciones: planTraining("Diagnóstico automotriz"),
      estado: "REVISAR",
      problemas_campos: {},
      advertencias: []
    }, {
      id: "plan-alias",
      archivo: { nombre: "UGA12B~1.PDF", hash: "hash-alias", ruta: "C:/planes/UGA12B~1.PDF", fecha_procesamiento: "2026-08-05T10:00:00.000Z" },
      docente: {
        codigo_documento: "UGA12B~1.PDF",
        periodo_plan: "",
        nombre: "Luis Miguel Lincango Cabezas",
        carrera: "Mecanica Automotriz"
      },
      diagnostico: {},
      capacitaciones: planTraining("Diagnóstico automotriz"),
      estado: "REVISAR",
      problemas_campos: {},
      advertencias: []
    }]);

    const consolidated = duplicateStorage.list();
    assert.strictEqual(consolidated.length, 1);
    assert.strictEqual(consolidated[0].docente.codigo_documento, "UGPA-RGI1-50-PRO-251-2025-10");
    assert.strictEqual(consolidated[0].archivos_relacionados.length, 2);
    assert.strictEqual(consolidated[0].deteccion.consolidado_duplicado, true);

    const agreementStorage = new AgreementStorage(path.join(root, "acuerdos"));
    agreementStorage.upsertMany([{
      id: "acuerdo-manual",
      archivo: { hash: "acuerdo-anterior", ruta: "C:/anterior/acuerdo.pdf" },
      acuerdo: {
        codigo: "UGPA-RGI2-69-PRO-134-2026-03",
        archivo_pdf_final: "C:/anterior/acuerdo.pdf",
        estado_acuerdo: "FIRMADO"
      },
      docente: { nombre: "Docente confirmado" },
      capacitacion: { id_plan: "cap-001", nombre: "Curso confirmado", vinculada: true },
      patrocinio: { financiamiento_total: true },
      vinculacion: { automatica: false, confianza: 100 },
      deteccion: { confirmado_manualmente: true, posible_acuerdo: true },
      estado: "COMPLETO",
      confianza: 100,
      campos_faltantes: [],
      correccion_manual: true,
      fecha_correccion: "2026-08-05T10:00:00.000Z",
      advertencias: []
    }]);

    agreementStorage.upsertMany([{
      id: "acuerdo-ocr-nuevo",
      archivo: { hash: "acuerdo-nuevo", ruta: "C:/nuevo/acuerdo.pdf" },
      acuerdo: {
        codigo: "UGPA-RGI2-69-PRO-134-2026-03",
        archivo_pdf_final: "C:/nuevo/acuerdo.pdf",
        estado_acuerdo: "REVISAR"
      },
      docente: { nombre: "OCR incorrecto" },
      capacitacion: { id_plan: "", nombre: "", vinculada: false },
      patrocinio: {},
      deteccion: { confirmado_manualmente: false },
      estado: "REVISAR",
      confianza: 30,
      campos_faltantes: ["Nombre completo"],
      correccion_manual: false,
      advertencias: ["OCR nuevo"]
    }]);

    const preservedAgreement = agreementStorage.list()[0];
    assert.strictEqual(preservedAgreement.id, "acuerdo-manual");
    assert.strictEqual(preservedAgreement.docente.nombre, "Docente confirmado");
    assert.strictEqual(preservedAgreement.archivo.ruta, "C:/nuevo/acuerdo.pdf");
    assert.strictEqual(preservedAgreement.acuerdo.archivo_pdf_final, "C:/nuevo/acuerdo.pdf");
    assert.strictEqual(preservedAgreement.capacitacion.id_plan, "cap-001");
    assert.strictEqual(preservedAgreement.deteccion.confirmado_manualmente, true);
    assert.deepStrictEqual(preservedAgreement.vinculacion, { automatica: false, confianza: 100 });

    console.log("Persistencia y consolidación de registros: pruebas correctas.");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
