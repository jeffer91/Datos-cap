"use strict";

const path = require("path");
const { ensureDir, readJson, writeJsonAtomic } = require("./storage");

class AgreementStorage {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.filePath = path.join(rootDir, "acuerdos-patrocinio.json");
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

  upsertMany(records) {
    const data = this.load();
    let inserted = 0;
    let updated = 0;
    for (const record of Array.isArray(records) ? records : []) {
      const hash = record?.archivo?.hash || "";
      const code = record?.acuerdo?.codigo || "";
      const index = data.records.findIndex((item) => {
        if (hash && item?.archivo?.hash === hash) return true;
        return code && item?.acuerdo?.codigo === code;
      });
      if (index >= 0) {
        const previous = data.records[index];
        data.records[index] = previous?.correccion_manual
          ? {
              ...record,
              id: previous.id,
              acuerdo: {
                ...previous.acuerdo,
                archivo_pdf_final: record?.archivo?.ruta || previous.acuerdo?.archivo_pdf_final || ""
              },
              docente: previous.docente,
              capacitacion: previous.capacitacion,
              patrocinio: previous.patrocinio,
              vinculacion: previous.vinculacion,
              deteccion: {
                ...(record.deteccion || {}),
                ...(previous.deteccion || {}),
                confirmado_manualmente: true
              },
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
    if (!id) throw new Error("No se recibió el identificador del acuerdo.");
    const data = this.load();
    const index = data.records.findIndex((item) => item?.id === id);
    if (index < 0) throw new Error("El acuerdo ya no existe en la base local.");
    data.records[index] = {
      ...updatedRecord,
      id,
      archivo: {
        ...data.records[index].archivo,
        ...(updatedRecord?.archivo || {})
      },
      acuerdo: {
        ...updatedRecord.acuerdo,
        archivo_pdf_final: data.records[index]?.archivo?.ruta || updatedRecord?.acuerdo?.archivo_pdf_final || ""
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
      errores: records.filter((item) => ["ERROR", "NO_ES_ACUERDO"].includes(item.estado)).length,
      firmados: records.filter((item) => item.acuerdo?.estado_acuerdo === "FIRMADO").length
    };
  }

  clear() {
    writeJsonAtomic(this.filePath, { version: 1, updatedAt: new Date().toISOString(), records: [] });
    return { ok: true };
  }
}

module.exports = { AgreementStorage };
