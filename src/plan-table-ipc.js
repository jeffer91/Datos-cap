"use strict";

const { parsePlanTable } = require("./plan-table");

function registerPlanTableIpc({ ipcMain, planStorage }) {
  ipcMain.handle("plans:import-table", async (_event, payload = {}) => {
    const parsed = parsePlanTable(payload.tableText || "");
    const saved = planStorage.upsertMany(parsed.records);
    return {
      ok: true,
      rows: parsed.rows,
      plans: parsed.plans,
      trainings: parsed.trainings,
      saved,
      records: planStorage.list(),
      summary: planStorage.getSummary()
    };
  });
}

module.exports = { registerPlanTableIpc };
