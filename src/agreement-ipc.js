"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { HybridPdfReader } = require("./hybrid-pdf-reader");
const {
  normalize,
  extractAgreementCode,
  extractPeriod,
  evaluateAgreement,
  parseAgreementText
} = require("./agreement-parser");
const { AgreementStorage } = require("./agreement-storage");
const { exportAgreementExcel, exportAgreementJson } = require("./agreement-exporter");

function tokenSet(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 1));
}

function similarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  a.forEach((token) => { if (b.has(token)) common += 1; });
  return common / Math.max(a.size, b.size);
}

function planTrainingOptions(planStorage) {
  return planStorage.list().flatMap((plan) => (plan.capacitaciones || []).map((training, index) => ({
    id: training.id || `${plan.id}:cap-${index + 1}`,
    planId: plan.id,
    teacher: plan.docente?.nombre || "",
    career: plan.docente?.carrera || "",
    period: plan.docente?.periodo_plan || "",
    name: training.nombre || "",
    order: index + 1
  })));
}

function matchTraining(record, planOptions) {
  let best = null;
  for (const option of planOptions) {
    const teacherScore = similarity(record.docente?.nombre, option.teacher);
    const trainingScore = similarity(record.capacitacion?.nombre, option.name);
    const periodScore = record.acuerdo?.periodo && option.period === record.acuerdo.periodo ? 1 : 0;
    const score = (teacherScore * 0.55) + (trainingScore * 0.4) + (periodScore * 0.05);
    if (!best || score > best.score) best = { option, score, teacherScore, trainingScore };
  }

  if (!best || best.teacherScore < 0.65 || best.trainingScore < 0.5 || best.score < 0.62) return record;
  return {
    ...record,
    capacitacion: {
      ...record.capacitacion,
      id_plan: best.option.id,
      plan_id: best.option.planId,
      vinculada: true
    },
    vinculacion: {
      confianza: Math.round(best.score * 100),
      automatica: true
    }
  };
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function uniquePdfPaths(filePaths, limit) {
  const seen = new Set();
  const output = [];
  for (const filePath of Array.isArray(filePaths) ? filePaths : []) {
    const resolved = path.resolve(String(filePath || ""));
    if (!resolved.toLowerCase().endsWith(".pdf")) continue;
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(resolved);
    if (output.length >= limit) break;
  }
  return output;
}

function scanFolder(folderPath, limit) {
  const files = [];
  const errors = [];
  const stack = [path.resolve(folderPath)];
  while (stack.length && files.length < limit) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      errors.push({ path: current, message: error.message });
      continue;
    }
    for (const entry of entries) {
      if (files.length >= limit) break;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) files.push(fullPath);
    }
  }
  return {
    files: uniquePdfPaths(files, limit),
    errors,
    truncated: files.length >= limit
  };
}

function stringValue(value) {
  return String(value == null ? "" : value).replace(/\r\n?/g, "\n").trim();
}

function boolValue(value) {
  return value === true || value === "true" || value === 1 || value === "1" || value === "Sí";
}

function sanitizeAgreementUpdate(current, payload, planOptions) {
  const code = stringValue(payload.acuerdo?.codigo);
  const selectedTrainingId = stringValue(payload.capacitacion?.id_plan);
  const selectedOption = planOptions.find((option) => option.id === selectedTrainingId) || null;
  const updated = {
    ...current,
    acuerdo: {
      codigo: code,
      fecha_suscripcion: stringValue(payload.acuerdo?.fecha_suscripcion),
      fecha_suscripcion_original: current.acuerdo?.fecha_suscripcion_original || "",
      periodo: stringValue(payload.acuerdo?.periodo) || extractPeriod(code),
      version_plantilla: stringValue(payload.acuerdo?.version_plantilla),
      estado_acuerdo: stringValue(payload.acuerdo?.estado_acuerdo),
      archivo_pdf_final: current.archivo?.ruta || ""
    },
    docente: {
      cedula: stringValue(payload.docente?.cedula),
      nombre: stringValue(payload.docente?.nombre),
      carrera: stringValue(payload.docente?.carrera),
      cargo: stringValue(payload.docente?.cargo)
    },
    capacitacion: {
      id_plan: selectedTrainingId,
      plan_id: selectedOption?.planId || stringValue(payload.capacitacion?.plan_id),
      nombre: selectedOption?.name || stringValue(payload.capacitacion?.nombre),
      vinculada: Boolean(selectedTrainingId)
    },
    patrocinio: {
      financiamiento_total: boolValue(payload.patrocinio?.financiamiento_total),
      financiamiento_parcial: boolValue(payload.patrocinio?.financiamiento_parcial),
      porcentaje_financiado: stringValue(payload.patrocinio?.porcentaje_financiado).replace(",", "."),
      anticipo_sueldo_honorarios: boolValue(payload.patrocinio?.anticipo_sueldo_honorarios),
      cambio_modalidad_trabajo: boolValue(payload.patrocinio?.cambio_modalidad_trabajo),
      licencia_remunerada: boolValue(payload.patrocinio?.licencia_remunerada),
      licencia_no_remunerada: boolValue(payload.patrocinio?.licencia_no_remunerada),
      ajuste_horario_laboral: boolValue(payload.patrocinio?.ajuste_horario_laboral)
    },
    correccion_manual: true,
    fecha_correccion: new Date().toISOString(),
    advertencias: (current.advertencias || []).filter((item) =>
      !/requiere confirmaci[oó]n manual|estado Firmado fue inferido|verifica visualmente las firmas/i.test(String(item || ""))
    ),
    deteccion: {
      ...(current.deteccion || {}),
      confirmado_como_acuerdo: true,
      posible_acuerdo: true,
      confirmado_manualmente: true
    }
  };

  if (!updated.patrocinio.financiamiento_parcial) updated.patrocinio.porcentaje_financiado = "";
  return evaluateAgreement(updated, { isAgreement: true, possibleAgreement: true });
}

function errorRecord(filePath, error) {
  let size = 0;
  try { size = fs.statSync(filePath).size; } catch (_error) { /* sin acción */ }
  return {
    id: crypto.randomUUID(),
    archivo: {
      nombre: path.basename(filePath),
      ruta: filePath,
      hash: "",
      tamano: size,
      paginas: 0,
      metodo_lectura: "ERROR",
      fecha_procesamiento: new Date().toISOString()
    },
    acuerdo: {
      codigo: "",
      fecha_suscripcion: "",
      fecha_suscripcion_original: "",
      periodo: "",
      version_plantilla: "",
      estado_acuerdo: "REVISAR",
      archivo_pdf_final: filePath
    },
    docente: { cedula: "", nombre: "", carrera: "", cargo: "" },
    capacitacion: { id_plan: "", plan_id: "", nombre: "", vinculada: false },
    patrocinio: {
      financiamiento_total: false,
      financiamiento_parcial: false,
      porcentaje_financiado: "",
      anticipo_sueldo_honorarios: false,
      cambio_modalidad_trabajo: false,
      licencia_remunerada: false,
      licencia_no_remunerada: false,
      ajuste_horario_laboral: false
    },
    estado: "ERROR",
    confianza: 0,
    campos_faltantes: [error?.message || "No se pudo procesar el archivo"],
    advertencias: [],
    correccion_manual: false,
    fecha_correccion: ""
  };
}

function registerAgreementIpc(options) {
  const {
    ipcMain,
    dialog,
    shell,
    getMainWindow,
    dataPath,
    planStorage,
    maxFiles = 500,
    emitProgress = () => {}
  } = options;
  const storage = new AgreementStorage(dataPath);
  let processing = false;

  async function processFiles(filePaths) {
    if (processing) throw new Error("Ya existe un procesamiento de acuerdos en curso.");
    const paths = uniquePdfPaths(filePaths, maxFiles);
    if (!paths.length) throw new Error("Selecciona al menos un acuerdo en PDF.");
    processing = true;
    const reader = new HybridPdfReader({ maxOcrPages: 8, ocrScale: 2.2 });
    const records = [];
    const planOptions = planTrainingOptions(planStorage);

    try {
      for (let index = 0; index < paths.length; index += 1) {
        const filePath = paths[index];
        const current = index + 1;
        emitProgress({
          scope: "agreements",
          phase: "file-start",
          current,
          total: paths.length,
          percent: Math.round((index / paths.length) * 100),
          fileName: path.basename(filePath),
          message: `Leyendo ${current} de ${paths.length}`
        });

        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile() || stat.size === 0) throw new Error("El archivo está vacío o no está disponible.");
          const reading = await reader.read(filePath, (detail) => emitProgress({
            ...detail,
            scope: "agreements",
            current,
            total: paths.length,
            fileName: path.basename(filePath),
            overallPercent: Math.round((index / paths.length) * 100)
          }));
          if (stringValue(reading.text).length < 80) throw new Error("No se obtuvo texto suficiente del PDF.");
          let record = parseAgreementText(reading.text, {
            filePath,
            fileName: path.basename(filePath),
            hash: hashFile(filePath),
            size: stat.size,
            pages: reading.pages,
            method: reading.method,
            warnings: reading.warnings
          });
          record = matchTraining(record, planOptions);
          record = evaluateAgreement(record, {
            isAgreement: record.deteccion?.confirmado_como_acuerdo,
            possibleAgreement: record.deteccion?.posible_acuerdo
          });
          records.push(record);
        } catch (error) {
          records.push(errorRecord(filePath, error));
        }

        emitProgress({
          scope: "agreements",
          phase: "file-complete",
          current,
          total: paths.length,
          percent: Math.round((current / paths.length) * 100),
          fileName: path.basename(filePath),
          message: `${current} de ${paths.length} procesados`
        });
      }

      const saved = storage.upsertMany(records);
      emitProgress({ scope: "agreements", phase: "complete", percent: 100, message: "Acuerdos procesados" });
      return { ok: true, processed: records.length, saved, records, summary: storage.getSummary() };
    } finally {
      processing = false;
      await reader.close().catch(() => {});
    }
  }

  ipcMain.handle("agreements:select-files", async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: "Seleccionar acuerdos de patrocinio",
      buttonLabel: "Agregar PDF",
      properties: ["openFile", "multiSelections", "dontAddToRecent"],
      filters: [{ name: "Archivos PDF", extensions: ["pdf"] }]
    });
    const filePaths = result.canceled ? [] : uniquePdfPaths(result.filePaths, maxFiles);
    return { canceled: result.canceled, filePaths, count: filePaths.length, limit: maxFiles };
  });

  ipcMain.handle("agreements:select-folder", async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: "Seleccionar carpeta con acuerdos de patrocinio",
      buttonLabel: "Usar carpeta",
      properties: ["openDirectory", "dontAddToRecent"]
    });
    if (result.canceled || !result.filePaths?.[0]) return { canceled: true, filePaths: [], count: 0, limit: maxFiles };
    const scan = scanFolder(result.filePaths[0], maxFiles);
    return {
      canceled: false,
      folderPath: result.filePaths[0],
      filePaths: scan.files,
      count: scan.files.length,
      errors: scan.errors,
      truncated: scan.truncated,
      limit: maxFiles
    };
  });

  ipcMain.handle("agreements:process", async (_event, payload) => processFiles(payload?.filePaths || []));
  ipcMain.handle("agreements:list", async () => ({
    ok: true,
    records: storage.list(),
    summary: storage.getSummary(),
    planOptions: planTrainingOptions(planStorage)
  }));
  ipcMain.handle("agreements:update", async (_event, payload) => {
    const id = stringValue(payload?.id);
    const current = storage.list().find((item) => item.id === id);
    if (!current) throw new Error("El acuerdo ya no existe en la base local.");
    const planOptions = planTrainingOptions(planStorage);
    const evaluated = sanitizeAgreementUpdate(current, payload || {}, planOptions);
    const saved = storage.updateById(id, evaluated);
    return {
      ok: true,
      record: saved,
      records: storage.list(),
      summary: storage.getSummary(),
      planOptions
    };
  });

  ipcMain.handle("agreements:export", async (_event, payload) => {
    const format = String(payload?.format || "xlsx").toLowerCase();
    const records = storage.list();
    if (!records.length) throw new Error("No existen acuerdos para exportar.");
    const extension = format === "json" ? "json" : "xlsx";
    const result = await dialog.showSaveDialog(getMainWindow(), {
      title: format === "json" ? "Exportar acuerdos en JSON" : "Exportar acuerdos en Excel",
      defaultPath: `acuerdos-patrocinio-${new Date().toISOString().slice(0, 10)}.${extension}`,
      filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    if (format === "json") exportAgreementJson(records, result.filePath);
    else exportAgreementExcel(records, result.filePath);
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle("agreements:open-file", async (_event, filePath) => {
    const resolved = path.resolve(String(filePath || ""));
    if (!fs.existsSync(resolved)) throw new Error("El PDF original ya no está disponible.");
    const error = await shell.openPath(resolved);
    if (error) throw new Error(error);
    return { ok: true };
  });

  ipcMain.handle("agreements:clear", async () => {
    storage.clear();
    return { ok: true, records: [], summary: storage.getSummary(), planOptions: planTrainingOptions(planStorage) };
  });

  return storage;
}

module.exports = {
  similarity,
  planTrainingOptions,
  matchTraining,
  sanitizeAgreementUpdate,
  registerAgreementIpc
};
