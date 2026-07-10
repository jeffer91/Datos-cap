/* Diagnóstico temporal para inspeccionar el modelo consolidado durante CI. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { LocalDatabase } = require("../database");
const { createReportDataRepository } = require("../reporting");
const { seed } = require("./report-data.repository.test");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "datos-cap-reporting-debug-"));
const database = new LocalDatabase(path.join(tempDirectory, "database"));
database.initialize();
seed(database);
const repository = createReportDataRepository(database);
const snapshot = repository.loadSnapshot({ period: "Marzo 2026" });
console.log(JSON.stringify({
  summary: snapshot.summary,
  periods: snapshot.periods,
  documents: snapshot.documents.map((item) => ({ id: item.id_documento, type: item.tipo_documental, active: item.activo, state: item.estado_version, period: item.periodo })),
  people: snapshot.people,
  courses: snapshot.courses,
  issues: snapshot.issues
}, null, 2));
