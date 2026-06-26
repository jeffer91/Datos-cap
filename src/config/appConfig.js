const APP_CONFIG = {
  appName: 'Video Auditor App',
  appVersion: '0.1.0',
  appMode: 'local-electron',

  description:
    'App local Electron para auditoría inteligente de videos, análisis de estilo, reportes PDF/TXT, biblioteca y plantillas de edición.',

  supportedVideoExtensions: [
    '.mp4',
    '.mov',
    '.mkv',
    '.avi',
    '.webm',
    '.m4v'
  ],

  supportedAudioExtensions: [
    '.mp3',
    '.wav',
    '.m4a',
    '.aac',
    '.flac'
  ],

  defaultVideoStyles: [
    'Dinámico',
    'Opinión',
    'Documental',
    'Storytelling',
    'Educativo potente',
    'Polémico / debate',
    'Resumen / noticia',
    'Motivacional / deportivo',
    'Otro'
  ],

  analysisModes: [
    {
      id: 'local',
      name: 'Local',
      description: 'Procesa todo lo posible en la PC.'
    },
    {
      id: 'external_ai',
      name: 'IA externa',
      description: 'Usa IA externa para mejorar interpretación y redacción.'
    },
    {
      id: 'complete',
      name: 'Completo',
      description: 'Combina procesamiento local e IA externa.'
    }
  ],

  reportTypes: {
    humanPdf: 'PDF para persona',
    technicalTxt: 'TXT técnico para computadora'
  }
};

module.exports = {
  APP_CONFIG
};
