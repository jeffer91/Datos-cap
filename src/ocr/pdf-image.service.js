/* =========================================================
Nombre completo: pdf-image.service.js
Ruta o ubicación: /src/ocr/pdf-image.service.js
Función o funciones:
- Convertir páginas de PDF en imágenes PNG para OCR.
- Permitir limitar páginas durante validaciones rápidas.
- Liberar correctamente los recursos del documento PDF.
- Admitir rutas largas de Windows.
========================================================= */
"use strict";

const { toDisplayPath, toLongPath } = require("../utils/file.utils");

async function loadPdfRenderer() {
  try {
    return await import("pdf-to-img");
  } catch (error) {
    throw new Error(`No se pudo cargar el convertidor PDF a imagen: ${error.message}`);
  }
}

async function renderPdfPages(filePath, options = {}) {
  const cleanPath = toDisplayPath(filePath);
  if (!cleanPath) throw new Error("No se recibió la ruta del PDF para convertirlo a imágenes.");

  const { pdf } = await loadPdfRenderer();
  const scale = Number.isFinite(options.scale) ? options.scale : 2.2;
  const maxPages = Number.isFinite(options.maxPages) ? Math.max(1, options.maxPages) : 40;
  const document = await pdf(toLongPath(cleanPath), { scale });
  const pages = [];

  try {
    const totalPages = Number(document.length || 0);
    const limit = Math.min(totalPages || maxPages, maxPages);

    for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
      if (typeof options.onPageRender === "function") {
        options.onPageRender(pageNumber, totalPages || limit);
      }

      const image = await document.getPage(pageNumber);
      pages.push({ pageNumber, image });
    }

    return {
      totalPages,
      renderedPages: pages.length,
      truncated: totalPages > pages.length,
      pages
    };
  } finally {
    if (document && typeof document.destroy === "function") {
      await document.destroy();
    }
  }
}

module.exports = {
  loadPdfRenderer,
  renderPdfPages
};