"use strict";

const assert = require("assert");

function run() {
  const hybrid = require("../src/hybrid-pdf-reader");
  assert.strictEqual(typeof hybrid.HybridPdfReader, "function");
  assert.strictEqual(typeof hybrid.assessDigitalText, "function");
  assert.strictEqual(typeof hybrid.getPdfRenderer, "function");

  const reader = new hybrid.HybridPdfReader({ maxOcrPages: 6 });
  assert.strictEqual(reader.maxOcrPages, 6);

  const positional = require("../src/positional-pdf-reader");
  assert.strictEqual(typeof positional.readPositionalPdf, "function");
  assert.strictEqual(typeof positional.groupWordsIntoLines, "function");
  assert.strictEqual(positional.isUsablePlanText("texto corto"), false);

  const pipeline = require("../src/plan-pipeline");
  assert.strictEqual(typeof pipeline.PlanProcessingEngine, "function");
  assert.strictEqual(typeof pipeline.problemCount, "function");

  console.log("Carga de lectores y motor paralelo: correcta.");
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
