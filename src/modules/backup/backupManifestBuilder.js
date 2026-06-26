function buildBackupManifest({ backupId, backupRoot, includeVideos, storagePaths, copiedItems, errors }) {
  return {
    type: 'video_auditor_backup',
    backupId,
    backupRoot,
    includeVideos: Boolean(includeVideos),
    generatedAt: new Date().toISOString(),
    app: { name: 'Video Auditor App', mode: 'local-electron' },
    sourcePaths: {
      database: storagePaths.database,
      analysisJson: storagePaths.analysisJson,
      templates: storagePaths.templates,
      transcripts: storagePaths.transcripts,
      reportsPdf: storagePaths.reportsPdf,
      reportsTxt: storagePaths.reportsTxt,
      logs: storagePaths.logs,
      videos: includeVideos ? storagePaths.videos : 'No incluido'
    },
    copiedItems,
    errors,
    notes: [
      'Este respaldo no restaura automáticamente datos.',
      'Para restauración manual o controlada, validar primero el manifiesto.',
      'Los videos solo se incluyen si includeVideos es true.'
    ]
  };
}

module.exports = { buildBackupManifest };
