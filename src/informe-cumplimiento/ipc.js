"use strict";

function registerComplianceReportIpc(ipcMain, getService) {
  const service = () => {
    const value = getService();
    if (!value) throw new Error("El servicio de Informe de Cumplimiento no está disponible.");
    return value;
  };

  ipcMain.handle("informe-cumplimiento:listar-guias", async () => service().listGuides());
  ipcMain.handle("informe-cumplimiento:guardar-guia", async (_event, guide) => service().saveGuide(guide || {}));
  ipcMain.handle("informe-cumplimiento:restaurar-guia", async (_event, guideId) => service().restoreGuide(guideId));
  ipcMain.handle("informe-cumplimiento:versiones-guia", async (_event, guideId) => service().listGuideVersions(guideId));
  ipcMain.handle("informe-cumplimiento:probar-guia", async (_event, payload) => service().testGuide(payload || {}));
  ipcMain.handle("informe-cumplimiento:generar-seccion", async (_event, payload) => service().generateSection(payload || {}));

  ipcMain.handle("informe-cumplimiento:configuracion-ia", async () => service().listAiConfiguration());
  ipcMain.handle("informe-cumplimiento:guardar-configuracion-ia", async (_event, config) => service().saveAiConfiguration(config || {}));
  ipcMain.handle("informe-cumplimiento:probar-proveedor-ia", async (_event, role) => service().testAiProvider(role));
  ipcMain.handle("informe-cumplimiento:probar-cadena-ia", async () => service().testAiChain());
  ipcMain.handle("informe-cumplimiento:exportar", async (_event, payload) => service().exportReport(payload || {}));
}

module.exports = { registerComplianceReportIpc };
