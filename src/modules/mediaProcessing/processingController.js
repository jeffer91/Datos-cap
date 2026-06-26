function handleProcessImportedVideo() {
  return Promise.resolve({
    ok: false,
    message: 'Procesamiento técnico pendiente de completar desde VS Code.'
  });
}

function handleGetMediaProcessingDiagnostic() {
  return {
    ok: true,
    module: 'mediaProcessing',
    status: 'base',
    message: 'Controlador base disponible. Falta completar motor FFmpeg real.'
  };
}

module.exports = {
  handleProcessImportedVideo,
  handleGetMediaProcessingDiagnostic
};
