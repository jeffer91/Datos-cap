/* =========================================================
Nombre completo: image-preprocessor.service.js
Ruta o ubicación: /src/ocr/image-preprocessor.service.js
Función o funciones:
- Validar las imágenes generadas desde un PDF antes del OCR.
- Mantener un punto único para incorporar mejoras de contraste o limpieza.
- Evitar enviar páginas vacías o inválidas al motor OCR.
========================================================= */
"use strict";

function assertImageBuffer(image) {
  if (!image || (!Buffer.isBuffer(image) && !(image instanceof Uint8Array))) {
    throw new Error("La página renderizada no contiene una imagen válida.");
  }

  if (image.length < 100) {
    throw new Error("La página renderizada está vacía o incompleta.");
  }

  return Buffer.isBuffer(image) ? image : Buffer.from(image);
}

async function preprocessImage(image) {
  return assertImageBuffer(image);
}

module.exports = {
  assertImageBuffer,
  preprocessImage
};
