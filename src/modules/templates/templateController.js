const { logError } = require('../../services/loggerService');

const {
  createMasterTemplate,
  listMasterTemplates,
  getMasterTemplate,
  getTemplateDiagnostic
} = require('./templateService');

function handleCreateMasterTemplate(payload) {
  try {
    return createMasterTemplate(payload || {});
  } catch (error) {
    logError('Error al crear plantilla maestra', error, payload);
    return {
      ok: false,
      message: 'No se pudo crear la plantilla maestra.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function handleListMasterTemplates(payload) {
  try {
    return listMasterTemplates(payload || {});
  } catch (error) {
    logError('Error al listar plantillas maestras', error, payload);
    return {
      ok: false,
      message: 'No se pudieron listar las plantillas.',
      error: { message: error.message }
    };
  }
}

function handleGetMasterTemplate(localId) {
  try {
    return getMasterTemplate(localId);
  } catch (error) {
    logError('Error al obtener plantilla maestra', error, { localId });
    return {
      ok: false,
      message: 'No se pudo obtener la plantilla.',
      error: { message: error.message }
    };
  }
}

function handleTemplateDiagnostic() {
  try {
    return getTemplateDiagnostic();
  } catch (error) {
    logError('Error en diagnóstico de plantillas', error);
    return {
      ok: false,
      message: 'No se pudo verificar el módulo de plantillas.',
      error: { message: error.message }
    };
  }
}

module.exports = {
  handleCreateMasterTemplate,
  handleListMasterTemplates,
  handleGetMasterTemplate,
  handleTemplateDiagnostic
};
