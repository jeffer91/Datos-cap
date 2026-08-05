"use strict";

const fs = require("fs");
const path = require("path");

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

class PlanStorage {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.filePath = path.join(rootDir, "planes-docentes.json");
    ensureDir(rootDir);
  }

  load() {
    const data = readJson(this.filePath, { version: 1, updatedAt: "", records: [] });
    if (!Array.isArray(data.records)) data.records = [];
    return data;
  }

  list() {
    return this.load().records;
  }

  upsert(record) {
    const data = this.load();
    const hash = record?.archivo?.hash || "";
    const code = record?.docente?.codigo_documento || "";
    const index = data.records.findIndex((item) => {
      if (hash && item?.archivo?.hash === hash) return true;
      return code && item?.docente?.codigo_documento === code;
    });
    if (index >= 0) data.records[index] = record;
    else data.records.push(record);
    data.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.filePath, data);
    return { inserted: index < 0, total: data.records.length };
  }

  upsertMany(records) {
    const data = this.load();
    let inserted = 0;
    let updated = 0;
    for (const record of Array.isArray(records) ? records : []) {
      const hash = record?.archivo?.hash || "";
      const code = record?.docente?.codigo_documento || "";
      const index = data.records.findIndex((item) => {
        if (hash && item?.archivo?.hash === hash) return true;
        return code && item?.docente?.codigo_documento === code;
      });
      if (index >= 0) {
        const previous = data.records[index];
        data.records[index] = previous?.correccion_manual
          ? {
              ...record,
              id: previous.id,
              docente: previous.docente,
              diagnostico: previous.diagnostico,
              capacitaciones: previous.capacitaciones,
              estado: previous.estado,
              confianza: previous.confianza,
              campos_faltantes: previous.campos_faltantes,
              correccion_manual: true,
              fecha_correccion: previous.fecha_correccion,
              advertencias: [...new Set([...(record.advertencias || []), ...(previous.advertencias || [])])]
            }
          : record;
        updated += 1;
      } else {
        data.records.push(record);
        inserted += 1;
      }
    }
    data.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.filePath, data);
    return { inserted, updated, total: data.records.length };
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
      }
    };
    data.updatedAt = new Date().toISOString();
    writeJsonAtomic(this.filePath, data);
    return data.records[index];
  }

  getSummary() {
    const records = this.list();
    return {
      total: records.length,
      completos: records.filter((item) => item.estado === "COMPLETO").length,
      revisar: records.filter((item) => item.estado === "REVISAR").length,
      errores: records.filter((item) => item.estado === "ERROR" || item.estado === "NO_ES_PLAN").length,
      capacitaciones: records.reduce((sum, item) => sum + (item.capacitaciones?.length || 0), 0)
    };
  }

  clear() {
    writeJsonAtomic(this.filePath, { version: 1, updatedAt: new Date().toISOString(), records: [] });
    return { ok: true };
  }
}

module.exports = { PlanStorage, ensureDir, readJson, writeJsonAtomic };
