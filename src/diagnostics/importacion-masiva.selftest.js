/* =========================================================
Nombre completo: importacion-masiva.selftest.js
Ruta o ubicación: /src/diagnostics/importacion-masiva.selftest.js
Función o funciones:
- Comprobar extracción de proceso y periodo académico desde rutas.
- Comprobar conciliación entre contenido y estructura de carpetas.
- Comprobar la generación del PDF institucional del SCAN.
========================================================= */
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseAcademicPeriod, parsePathContext } = require("../importacion-masiva/path-context.parser");
const { reconcileClassification } = require("../importacion-masiva/importacion-masiva.service");
const { buildScanReportData, exportScanReportPdf } = require("../importacion-masiva/scan-report.exporter");

async function run() {
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

  const snapshot = {
    batch: {
      id: "import_scan_pdf_selftest",
      rootPath: "C:\\Procesos Misionales",
      startedAt: "2026-08-04T10:00:00-05:00",
      scannedAt: "2026-08-04T10:01:00-05:00",
      truncated: false,
      scanErrors: []
    },
    files: [
      {
        id: "file_1",
        path: "C:\\Procesos Misionales\\Plan individual\\plan.pdf",
        relativePath: "Plan individual\\plan.pdf",
        processCode: "PRO-251",
        processCodes: ["PRO-251"],
        academicPeriod: "Octubre 2025–Marzo 2026",
        detectedType: "plan-individual",
        detectedLabel: "Plan Individual",
        confidence: 100,
        extractionMethod: "digital",
        status: "READY",
        sizeBytes: 204800,
        reasons: ["Código institucional RGI1 + PRO-251."],
        errors: [],
        warnings: []
      },
      {
        id: "file_2",
        path: "C:\\Procesos Misionales\\Acuerdos\\acuerdo.pdf",
        relativePath: "Acuerdos\\acuerdo.pdf",
        processCode: "PRO-134",
        processCodes: ["PRO-134"],
        academicPeriod: "Octubre 2025–Marzo 2026",
        detectedType: "acuerdo-patrocinio",
        detectedLabel: "Acuerdo de Patrocinio",
        confidence: 78,
        extractionMethod: "ocr",
        status: "REVIEW",
        sizeBytes: 102400,
        reasons: ["La carpeta y el encabezado presentan señales diferentes."],
        errors: [],
        warnings: []
      },
      {
        id: "file_3",
        path: "C:\\Procesos Misionales\\archivo-vacio.pdf",
        relativePath: "archivo-vacio.pdf",
        processCode: "",
        processCodes: [],
        academicPeriod: "",
        detectedType: "desconocido",
        detectedLabel: "No identificado",
        confidence: 0,
        extractionMethod: "failed",
        status: "EMPTY",
        sizeBytes: 0,
        reasons: ["El archivo está vacío y no puede procesarse."],
        errors: ["El PDF tiene tamaño de 0 bytes."],
        warnings: []
      }
    ],
    summary: {
      total: 3,
      ready: 1,
      review: 1,
      unsupported: 0,
      empty: 1,
      inaccessible: 0,
      digital: 1,
      ocr: 1
    }
  };

  const reportData = buildScanReportData(snapshot);
  assert.strictEqual(reportData.summary.total, 3);
  assert.strictEqual(reportData.issues.length, 2);
  assert.deepStrictEqual(reportData.processCodes, ["PRO-134", "PRO-251"]);

  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-scan-pdf-"));
  const exported = await exportScanReportPdf(snapshot, outputDir);
  assert.strictEqual(exported.ok, true);
  assert.strictEqual(exported.totalFiles, 3);
  assert.strictEqual(exported.issueCount, 2);
  assert.ok(fs.existsSync(exported.filePath), "No se creó el PDF del SCAN.");
  assert.ok(fs.statSync(exported.filePath).size > 1000, "El PDF del SCAN está vacío o incompleto.");
  assert.strictEqual(fs.readFileSync(exported.filePath).subarray(0, 4).toString("utf8"), "%PDF");

  console.log("Importación masiva y PDF del SCAN: pruebas correctas.");
}

if (require.main === module) {
  run().catch((error) => {
    console.error("IMPORTACION_MASIVA_SELFTEST_ERROR");
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { run };
