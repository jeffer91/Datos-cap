/* =========================================================
Nombre completo: pdf-fixture.generator.js
Ruta o ubicación: /src/diagnostics/pdf-fixture.generator.js
Función o funciones:
- Generar archivos PDF reales a partir de estructuras institucionales representativas.
- Crear siete PDF digitales y un PDF escaneado sin capa de texto.
- Reutilizar los casos de regresión de los ocho procesadores.
- Mantener los documentos privados fuera del repositorio y de los artefactos CI.
========================================================= */

"use strict";

const fs = require("fs");
const path = require("path");
const { BrowserWindow } = require("electron");

const { createSyntheticPdfDocument } = require("./plan-individual.parser.test");
const { createSyntheticPlanningDocument } = require("./planificacion-curso.parser.test");
const { createSyntheticAgreementDocument } = require("./acuerdo-patrocinio.parser.test");
const { createSyntheticFinalReport } = require("./informe-final.parser.test");
const { createSyntheticEvaluationInstrument } = require("./instrumento-evaluacion.parser.test");
const { createSyntheticImpactReport } = require("./informe-impacto.parser.test");
const { createSyntheticNeedsDetection } = require("./deteccion-necesidades.parser.test");
const { createSyntheticGeneralPlan } = require("./plan-general-capacitacion.parser.test");

const FIXTURE_SOURCES = Object.freeze([
  { documentType: "plan-individual", factory: createSyntheticPdfDocument, mode: "digital" },
  { documentType: "planificacion-curso", factory: createSyntheticPlanningDocument, mode: "digital" },
  { documentType: "acuerdo-patrocinio", factory: createSyntheticAgreementDocument, mode: "scanned" },
  { documentType: "informe-final", factory: createSyntheticFinalReport, mode: "digital" },
  { documentType: "instrumento-evaluacion", factory: createSyntheticEvaluationInstrument, mode: "digital" },
  { documentType: "informe-impacto", factory: createSyntheticImpactReport, mode: "digital" },
  { documentType: "deteccion-necesidades", factory: createSyntheticNeedsDetection, mode: "digital" },
  { documentType: "plan-general-capacitacion", factory: createSyntheticGeneralPlan, mode: "digital" }
]);

function ensureDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath)) fs.mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeFixtureText(value) {
  return String(value || "")
    .replace(/\uFFFE/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkLines(text, maxLines = 48) {
  const lines = normalizeFixtureText(text).split("\n");
  const pages = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines));
  }
  return pages.length ? pages : [["Documento de prueba"]];
}

function buildDigitalHtml(text) {
  const pages = chunkLines(text).map((lines) => `
    <section class="page"><pre>${escapeHtml(lines.join("\n"))}</pre></section>
  `).join("");

  return `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: A4; margin: 11mm; }
      html, body { margin: 0; padding: 0; background: white; color: black; }
      .page { page-break-after: always; min-height: 270mm; }
      .page:last-child { page-break-after: auto; }
      pre {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 10.5px;
        line-height: 1.34;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    </style>
  </head>
  <body>${pages}</body>
  </html>`;
}

function buildScannedHtml(text) {
  const safeText = JSON.stringify(normalizeFixtureText(text));
  return `<!doctype html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: white; }
      #scan { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <canvas id="scan"></canvas>
    <script>
      (function () {
        const text = ${safeText};
        const canvas = document.getElementById("scan");
        const width = 1240;
        const margin = 70;
        const fontSize = 28;
        const lineHeight = 39;
        const maxWidth = width - (margin * 2);
        const measure = document.createElement("canvas").getContext("2d");
        measure.font = fontSize + "px Arial";
        const wrapped = [];

        text.split("\\n").forEach((sourceLine) => {
          const words = sourceLine.trim().split(/\\s+/).filter(Boolean);
          if (!words.length) {
            wrapped.push("");
            return;
          }
          let current = "";
          words.forEach((word) => {
            const candidate = current ? current + " " + word : word;
            if (measure.measureText(candidate).width > maxWidth && current) {
              wrapped.push(current);
              current = word;
            } else {
              current = candidate;
            }
          });
          if (current) wrapped.push(current);
        });

        canvas.width = width;
        canvas.height = Math.max(1754, margin * 2 + wrapped.length * lineHeight);
        const context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "black";
        context.font = fontSize + "px Arial";
        context.textBaseline = "top";
        wrapped.forEach((line, index) => context.fillText(line, margin, margin + index * lineHeight));
        window.fixtureReady = true;
      })();
    </script>
  </body>
  </html>`;
}

async function loadHtmlAndPrint(window, htmlPath, outputPath) {
  await window.loadFile(htmlPath);
  await window.webContents.executeJavaScript("Boolean(window.fixtureReady || document.readyState === 'complete')");
  const buffer = await window.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true,
    pageSize: "A4",
    margins: { marginType: "none" }
  });
  await fs.promises.writeFile(outputPath, buffer);
  return outputPath;
}

async function generateFixtureSet(outputDirectory) {
  const directory = ensureDirectory(path.resolve(outputDirectory));
  const workingDirectory = ensureDirectory(path.join(directory, ".html"));
  const window = new BrowserWindow({
    width: 1240,
    height: 1754,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const fixtures = [];

  try {
    for (const sourceDefinition of FIXTURE_SOURCES) {
      const source = sourceDefinition.factory();
      const outputPath = path.join(directory, source.fileName);
      const htmlPath = path.join(workingDirectory, `${sourceDefinition.documentType}.html`);
      const html = sourceDefinition.mode === "scanned"
        ? buildScannedHtml(source.text)
        : buildDigitalHtml(source.text);

      await fs.promises.writeFile(htmlPath, html, "utf8");
      await loadHtmlAndPrint(window, htmlPath, outputPath);

      fixtures.push({
        documentType: sourceDefinition.documentType,
        mode: sourceDefinition.mode,
        fileName: source.fileName,
        filePath: outputPath,
        sourceTextLength: normalizeFixtureText(source.text).length,
        sizeBytes: fs.statSync(outputPath).size
      });
    }
  } finally {
    if (!window.isDestroyed()) window.destroy();
    try { fs.rmSync(workingDirectory, { recursive: true, force: true }); } catch (_error) { /* Sin acción. */ }
  }

  return fixtures;
}

module.exports = {
  FIXTURE_SOURCES,
  ensureDirectory,
  escapeHtml,
  normalizeFixtureText,
  chunkLines,
  buildDigitalHtml,
  buildScannedHtml,
  generateFixtureSet
};
