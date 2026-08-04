"use strict";

const fs = require("fs");
const path = require("path");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(temp, filePath);
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

  clear() {
    writeJsonAtomic(this.filePath, { version: 1, updatedAt: new Date().toISOString(), records: [] });
  }
}

module.exports = { PlanStorage };
