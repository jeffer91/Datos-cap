/* =========================================================
Nombre completo: carga.service.js
Ruta o ubicación: /src/funcionalidades/01-carga/carga.service.js
Función principal:
- Validar archivos de video seleccionados o arrastrados.
- Analizar metadatos básicos: nombre, peso, duración, ancho, alto y orientación.
- Mantener separada la lógica técnica de la pantalla visual.
========================================================= */
(function(window, document) {
  'use strict';

  function obtenerMensajeInicial() {
    return 'Selecciona o arrastra tus videos.';
  }

  function esArchivoVideo(archivo) {
    if (!archivo) return false;
    const tipo = String(archivo.type || '').toLowerCase();
    const nombre = String(archivo.name || '').toLowerCase();
    const extensiones = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'];
    return tipo.startsWith('video/') || extensiones.some((extension) => nombre.endsWith(extension));
  }

  function formatearPeso(bytes) {
    const valor = Number(bytes || 0);
    if (!Number.isFinite(valor) || valor <= 0) return '0 MB';
    const mb = valor / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  function formatearDuracion(segundos) {
    const total = Math.round(Number(segundos || 0));
    if (!Number.isFinite(total) || total <= 0) return '0:00';
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (horas > 0) return `${horas}:${String(minutos).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${minutos}:${String(secs).padStart(2, '0')}`;
  }

  function detectarOrientacion(ancho, alto) {
    const w = Number(ancho || 0);
    const h = Number(alto || 0);
    if (!w || !h) return 'desconocido';
    const ratio = w / h;
    if (ratio > 1.1) return 'horizontal';
    if (ratio < 0.9) return 'vertical';
    return 'cuadrado';
  }

  function analizarVideoArchivo(archivo) {
    return new Promise((resolve, reject) => {
      if (!esArchivoVideo(archivo)) {
        reject(new Error(`Archivo no válido: ${archivo?.name || 'sin nombre'}`));
        return;
      }

      const video = document.createElement('video');
      const url = URL.createObjectURL(archivo);
      let finalizado = false;

      function limpiar() {
        URL.revokeObjectURL(url);
        video.removeAttribute('src');
        video.load();
      }

      function resolver() {
        if (finalizado) return;
        finalizado = true;

        const ancho = Number(video.videoWidth || 0);
        const alto = Number(video.videoHeight || 0);
        const duracionSegundos = Number(video.duration || 0);
        const orientacion = detectarOrientacion(ancho, alto);

        limpiar();
        resolve({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          archivo,
          nombre: archivo.name,
          mime: archivo.type || 'video/desconocido',
          pesoBytes: archivo.size,
          pesoTexto: formatearPeso(archivo.size),
          duracionSegundos,
          duracionTexto: formatearDuracion(duracionSegundos),
          ancho,
          alto,
          resolucion: ancho && alto ? `${ancho}x${alto}` : 'desconocida',
          orientacion
        });
      }

      function fallar() {
        if (finalizado) return;
        finalizado = true;
        limpiar();
        reject(new Error(`No se pudo leer el video: ${archivo.name}`));
      }

      video.preload = 'metadata';
      video.onloadedmetadata = resolver;
      video.onerror = fallar;
      video.src = url;
    });
  }

  async function analizarVideos(archivos) {
    const lista = Array.from(archivos || []);
    const videos = lista.filter(esArchivoVideo);

    if (!videos.length) {
      throw new Error('Selecciona al menos un archivo de video válido.');
    }

    return Promise.all(videos.map(analizarVideoArchivo));
  }

  window.VideoEditorCargaService = {
    obtenerMensajeInicial,
    esArchivoVideo,
    formatearPeso,
    formatearDuracion,
    detectarOrientacion,
    analizarVideoArchivo,
    analizarVideos
  };
})(window, document);
