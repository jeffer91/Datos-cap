const path = require('path');
const { APP_CONFIG } = require('../config/appConfig');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeText(value) {
  return String(value || '').trim();
}

function validateRequiredFields(data, requiredFields = []) {
  const errors = [];

  requiredFields.forEach((field) => {
    if (!isNonEmptyString(data[field])) {
      errors.push({
        field,
        message: `El campo "${field}" es obligatorio.`
      });
    }
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

function validateVideoExtension(filePath) {
  if (!isNonEmptyString(filePath)) {
    return {
      ok: false,
      message: 'No se recibió una ruta de video válida.'
    };
  }

  const extension = path.extname(filePath).toLowerCase();

  if (!APP_CONFIG.supportedVideoExtensions.includes(extension)) {
    return {
      ok: false,
      message: `Formato no permitido: ${extension}`,
      allowedExtensions: APP_CONFIG.supportedVideoExtensions
    };
  }

  return {
    ok: true,
    extension
  };
}

function validateStyle(styleName) {
  const cleanStyle = sanitizeText(styleName);

  if (!cleanStyle) {
    return {
      ok: false,
      message: 'Debes seleccionar o escribir un estilo.'
    };
  }

  return {
    ok: true,
    style: cleanStyle
  };
}

function createSafeFileName(value) {
  const cleanValue = sanitizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  return cleanValue || `archivo_${Date.now()}`;
}

module.exports = {
  isNonEmptyString,
  sanitizeText,
  validateRequiredFields,
  validateVideoExtension,
  validateStyle,
  createSafeFileName
};
