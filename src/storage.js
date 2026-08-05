"use strict";

const fs = require("fs");
const path = require("path");
const {
  duplicateScore,
  mergePlanRecords,
  isValidPlanCode
} = require("./plan-intelligence");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch (_error) {
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temp = `${filePath}.tmp`;
  const backup = `${filePath}.bak`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    if (fs.existsSync(filePath)) fs.renameSync(filePath, backup);
    fs.renameSync(temp, filePath);
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(backup)) fs.renameSync(backup, filePath);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    throw error;
  }
}

function exactMatch(left, right) {
  const leftHash = left?.archivo?.hash || "";
  const rightHash = right?.archivo?.hash || "";
  if (leftHash && rightHash && leftHash === rightHash) return true;

  const leftCode = String(left?.docente?.codigo_documento || "").trim();
  const rightCode = String(right?.docente?.codigo_documento || "").trim();
  if (!leftCode || !rightCode) return false;
  if (isValidPlanCode(leftCode) && isValidPlanCode(rightCode)) return leftCode === rightCode;
  return leftCode === rightCode && /PRO-251/i.test(leftCode);
}

function findDuplicateIndex(records, record, excludedIndex = -1) {
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < records.length; index += 1) {
    if (index === excludedIndex) continue;
    const current = records[index];
    if (exactMatch(current, record)) return index;
    const score = duplicateScore(current, record);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestScore >= 0.93 ? bestIndex : -1;
}

function consolidateRecords(records) {
  const output = [];
  let removed = 0;
  for (const record of Array.isArray(records) ? records : []) {
    const index = findDuplicateIndex(output, record);
    if (index < 0) {
      output.push(record);
      continue;
    }
    const previousId = output[index]?.id || record?.id;
    output[index] = {
      ...mergePlanRecords(output[index], record),
      id: previousId
    };
    removed += 1;
  }
  return { records: output, removed };
}

class PlanStorage {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.filePath = path.join(rootDir, "planes-docentes.json");
    ensureDir(rootDir);
  }

  load() {
    const data = readJson(this.filePath, { version: 2, updatedAt: "", records: [] });
    if (!Array.isArray(data.records)) data.records = [];
    return data;
  }

  list() {
    return this.load().records;
  }

  upsert(record) {
    const result = this.upsertMany([record]);
    return { inserted: result.inserted === 1, total: result.total, consolidated: result.consolidated };
  }

  upsertMany(records) {
    const data = this.load();
    let inserted = 0;
    let updated = 0;

    for (const record of Array.isArray(records) ? records : []) {
      const index = findDuplicateIndex(data.records, record);
      if (index >= 0) {
        const previousId = data.records[index]?.id || record?.id;
        data.records[index] = {
          ...mergePlanRecords(data.records[index], record),
          id: previousId
        };
        updated += 1;
      } else {
        data.records.push(record);
        inserted += 1;
      }
    }

    const consolidated = consolidateRecords(data.records);
    data.records = consolidated.records;
    data.version = 2;
    data.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.filePath, data);
    return {
      inserted,
      updated,
      consolidated: consolidated.removed,
      total: data.records.length
    };
  }

  deduplicate() {
    const data = this.load();
    const consolidated = consolidateRecords(data.records);
    if (consolidated.removed > 0) {
      data.records = consolidated.records;
      data.version = 2;
      data.updatedAt = new Date().toISOString();
      writeJsonAtomic(this.filePath, data);
    }
    return { removed: consolidated.removed, total: consolidated.records.length };
  }

  updateById(recordId, updatedRecord) {
    const id = String(recordId || "").trim();
    if (!id) throw new Error("No se recibió el identificador del plan.");
    const data = this.load();
    const index = data.records.findIndex((item) => item?.id === id);
    if (index < 0) throw new Error("El plan ya no existe en la base local.");
    data.records[index] = {
      ...updatedRecord,
      id,
      archivo: {
        ...data.records[index].archivo,
        ...(updatedRecord?.archivo || {})
      },
      archivos_relacionados: updatedRecord?.archivos_relacionados || data.records[index]?.archivos_relacionados || []
    };
    const consolidated = consolidateRecords(data.records);
    data.records = consolidated.records;
    data.version = 2;
    data.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.filePath, data);
    return data.records.find((item) => item?.id === id) || updatedRecord;
  }

  getSummary() {
    const records = this.list();
    return {
      total: records.length,
      completos: records.filter((item) => item.estado === "COMPLETO").length,
      revisar: records.filter((item) => item.estado === "REVISAR").length,
      errores: records.filter((item) => item.estado === "ERROR" || item.estado === "NO_ES_PLAN").length,
      capacitaciones: records.reduce((sum, item) => sum + (item.capacitaciones?.length || 0), 0),
      consolidados: records.filter((item) => item.deteccion?.consolidado_duplicado).length
    };
  }

  clear() {
    writeJsonAtomic(this.filePath, { version: 2, updatedAt: new Date().toISOString(), records: [] });
    return { ok: true };
  }
}

module.exports = {
  PlanStorage,
  ensureDir,
  readJson,
  writeJsonAtomic,
  exactMatch,
  findDuplicateIndex,
  consolidateRecords
};
