/* =========================================================
Nombre completo: importacion-masiva.selftest.js
Ruta o ubicación: /src/diagnostics/importacion-masiva.selftest.js
Función o funciones:
- Comprobar extracción de proceso y periodo académico desde rutas.
- Comprobar conciliación entre contenido y estructura de carpetas.
========================================================= */
"use strict";

const assert = require("assert");
const { parseAcademicPeriod, parsePathContext } = require("../importacion-masiva/path-context.parser");
const { reconcileClassification } = require("../importacion-masiva/importacion-masiva.service");

function run() {
  const period = parseAcademicPeriod("UGPA-PRO-251-Octubre 2025–Marzo 2026");
  assert.deepStrictEqual(period && { label: period.label, start: period.start, end: period.end }, {
    label: "Octubre 2025–Marzo 2026",
    start: "2025-10",
    end: "2026-03"
  });

  const context = parsePathContext({
    rootPath: "C:\\Procesos Misionales",
    path: "C:\\Procesos Misionales\\UGPA-PRO-251-Planificacion-de-Capacitacion-y-Formacion-Individual-a-Docentes\\UGPA-PRO-251-Octubre 2025–Marzo 2026\\UGPA-PRO-251-Plan individual\\UGPA-RGI1-01-PRO-251-2025-10-Willian.pdf",
    relativePath: "UGPA-PRO-251-Planificacion-de-Capacitacion-y-Formacion-Individual-a-Docentes\\UGPA-PRO-251-Octubre 2025–Marzo 2026\\UGPA-PRO-251-Plan individual\\UGPA-RGI1-01-PRO-251-2025-10-Willian.pdf"
  });
  assert.strictEqual(context.processCode, "PRO-251");
  assert.strictEqual(context.academicPeriod, "Octubre 2025–Marzo 2026");
  assert.strictEqual(context.documentMonth, "2025-10");
  assert.strictEqual(context.pathHint.type, "plan-individual");

  const ready = reconcileClassification(
    { type: "plan-individual", confidence: 100, reason: "RGI1 + PRO-251", signals: ["RGI1 + PRO-251"] },
    context,
    { ok: true }
  );
  assert.strictEqual(ready.status, "READY");
  assert.strictEqual(ready.detectedType, "plan-individual");

  const conflict = reconcileClassification(
    { type: "acuerdo-patrocinio", confidence: 100, reason: "RGI2 + PRO-134", signals: ["RGI2 + PRO-134"] },
    context,
    { ok: true }
  );
  assert.strictEqual(conflict.status, "REVIEW");

  console.log("Importación masiva: pruebas correctas.");
}

run();
