const path = require('path');
const crypto = require('crypto');

const { buildVideoWorkFolder, getStoragePaths } = require('../../services/pathService');
const { ensureDirs, writeJson } = require('../../services/fileService');
const { logInfo, logError } = require('../../services/loggerService');
const { findVideoByLocalId, updateVideo } = require('../../database/repositories/videoRepository');
const { createAnalysis, replaceTechnicalEvents } = require('../../database/repositories/analysisRepository');
const { readMediaMetadata } = require('./metadataProbe');
const { exportAudioWav } = require('./audioExport');
const { exportFrames } = require('./frameExport');
const { scanVisualChanges, analyzeVisualFrequency } = require('../mediaProcessing/mediaVisualScan');
const { scanAudioPauses, analyzeAudioPacing } = require('../mediaProcessing/mediaAudioScan');

function createAnalysisLocalId() {
  const random = crypto.randomBytes(4).toString('hex');
  return `analysis_${Date.now()}_${random}`;
}

function buildMetadataEvents(metadata) {
  return [
    {
      event_type: 'metadata_summary',
      event_label: 'Resumen técnico del video',
      start_time: '00:00',
      end_time: null,
      start_seconds: 0,
      end_seconds: metadata.durationSeconds || null,
      confidence: null,
      details_json: {
        durationSeconds: metadata.durationSeconds,
        fps: metadata.fps,
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        hasAudio: metadata.hasAudio,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec
      }
    }
  ];
}

function buildVisualEvents(visualEvents = []) {
  return visualEvents.map((event, index) => ({
    event_type: 'cut_detected',
    event_label: `Cambio visual ${index + 1}`,
    start_time: event.start_time,
    end_time: event.end_time,
    start_seconds: event.start_seconds,
    end_seconds: event.end_seconds,
    confidence: event.confidence,
    details_json: event.details_json
  }));
}

async function processVideoWithMediaEngine(payload = {}) {
  try {
    const videoLocalId = payload.videoLocalId;
    const analysisMode = payload.analysisMode || 'local';

    if (!videoLocalId) {
      return { ok: false, message: 'No se recibió el ID local del video.' };
    }

    const video = findVideoByLocalId(videoLocalId);

    if (!video) {
      return { ok: false, message: 'No se encontró el video importado.' };
    }

    if (!video.local_video_path) {
      return { ok: false, message: 'El video no tiene ruta local registrada.' };
    }

    const analysisLocalId = createAnalysisLocalId();
    const workFolders = buildVideoWorkFolder(video.local_id);

    ensureDirs([
      workFolders.root,
      workFolders.audio,
      workFolders.frames,
      workFolders.transcripts,
      workFolders.reports,
      workFolders.temp
    ]);

    const metadata = await readMediaMetadata(video.local_video_path);

    let audioResult = {
      ok: false,
      audioPath: null,
      message: 'El video no tiene audio detectable.'
    };

    if (metadata.hasAudio) {
      audioResult = await exportAudioWav({
        videoPath: video.local_video_path,
        outputFolder: workFolders.audio
      });
    }

    const frameResult = await exportFrames({
      videoPath: video.local_video_path,
      outputFolder: workFolders.frames,
      durationSeconds: metadata.durationSeconds,
      preferredInterval: 5,
      maxFrames: 300
    });

    const visualScan = await scanVisualChanges({
      videoPath: video.local_video_path,
      threshold: 0.3
    });

    const visualFrequency = analyzeVisualFrequency(
      visualScan.events,
      metadata.durationSeconds
    );

    let silenceResult = {
      ok: false,
      silenceCount: 0,
      silences: [],
      technicalEvents: [],
      message: 'No se analizaron pausas porque no hay audio disponible.'
    };

    let audioRhythm = {
      ok: false,
      silenceCount: 0,
      speechSegmentCount: 0,
      speechSegments: [],
      rhythm: {
        level: 'unknown',
        label: 'Ritmo de audio no determinado'
      },
      technicalEvents: []
    };

    if (audioResult.ok && audioResult.audioPath) {
      silenceResult = await scanAudioPauses({
        audioPath: audioResult.audioPath,
        noiseThreshold: '-35dB',
        minSilenceDuration: 0.35
      });

      audioRhythm = analyzeAudioPacing({
        silences: silenceResult.silences,
        durationSeconds: metadata.durationSeconds
      });
    }

    const updatedVideo = updateVideo(video.local_id, {
      duration_seconds: metadata.durationSeconds,
      fps: metadata.fps,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      status: 'media_processed'
    });

    const storagePaths = getStoragePaths();
    const analysisJsonPath = path.join(storagePaths.analysisJson, `${analysisLocalId}.media.json`);

    const technicalJson = {
      analysisLocalId,
      videoLocalId: video.local_id,
      originalName: video.original_name,
      creatorName: video.creator_name,
      styleName: video.style_name,
      topic: video.topic,
      generatedAt: new Date().toISOString(),
      engine: 'mediaEngine',
      metadata,
      outputs: {
        workFolders,
        audio: audioResult,
        frames: {
          outputFolder: frameResult.outputFolder,
          intervalSeconds: frameResult.intervalSeconds,
          frameCount: frameResult.frameCount
        }
      },
      visual: {
        scan: visualScan,
        frequency: visualFrequency
      },
      audioAnalysis: {
        silence: silenceResult,
        rhythm: audioRhythm
      },
      notes: [
        'Bloque 18 activa procesamiento real de metadatos, audio, frames, cortes visuales y pausas.',
        'Transcripción real queda para un bloque posterior.'
      ]
    };

    writeJson(analysisJsonPath, technicalJson);

    const createdAnalysis = createAnalysis({
      local_id: analysisLocalId,
      video_local_id: video.local_id,
      analysis_mode: analysisMode,
      status: 'media_processed',
      summary: 'Procesamiento multimedia real completado: metadatos, audio, frames, cortes visuales y pausas.',
      human_summary: 'La app leyó datos reales del video, extrajo audio si existía, generó fotogramas, detectó cambios visuales y pausas de audio.',
      technical_summary: 'FFprobe metadata + FFmpeg audio extraction + FFmpeg frame extraction + scene select + silencedetect.',
      audio_path: audioResult.audioPath || null,
      frames_folder_path: frameResult.outputFolder,
      transcript_path: null,
      analysis_json_path: analysisJsonPath,
      pdf_report_path: null,
      txt_report_path: null,
      cut_count: visualFrequency.cutCount || 0,
      average_cut_seconds: visualFrequency.averageCutSeconds,
      frame_count: frameResult.frameCount,
      silence_count: silenceResult.silenceCount || 0,
      music_event_count: 0,
      transcript_word_count: 0,
      hook_count: 0,
      section_count: 0,
      error_message: null
    });

    const savedTechnicalEvents = replaceTechnicalEvents(analysisLocalId, [
      ...buildMetadataEvents(metadata),
      ...buildVisualEvents(visualScan.events),
      ...silenceResult.technicalEvents
    ]);

    logInfo('Procesamiento mediaEngine completado', {
      videoLocalId: video.local_id,
      analysisLocalId,
      frameCount: frameResult.frameCount,
      hasAudio: metadata.hasAudio,
      cutCount: visualFrequency.cutCount,
      silenceCount: silenceResult.silenceCount,
      analysisJsonPath
    });

    return {
      ok: true,
      message: 'Procesamiento multimedia real completado.',
      video: updatedVideo,
      analysis: createdAnalysis,
      metadata,
      audio: audioResult,
      frames: {
        outputFolder: frameResult.outputFolder,
        intervalSeconds: frameResult.intervalSeconds,
        frameCount: frameResult.frameCount
      },
      visual: {
        scan: visualScan,
        frequency: visualFrequency
      },
      audioAnalysis: {
        silence: silenceResult,
        rhythm: audioRhythm
      },
      analysisJsonPath,
      savedTechnicalEvents,
      workFolders
    };
  } catch (error) {
    logError('Error en mediaEngine', error, payload);

    return {
      ok: false,
      message: 'No se pudo procesar el video con mediaEngine.',
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

function getMediaEngineDiagnostic() {
  return {
    ok: true,
    module: 'mediaEngine',
    status: 'ready',
    features: [
      'lectura real de metadatos con ffprobe',
      'extracción real de audio wav',
      'extracción real de frames jpg',
      'detección real de cambios visuales',
      'detección real de pausas de audio',
      'guardado en SQLite',
      'guardado de JSON técnico'
    ]
  };
}

module.exports = {
  processVideoWithMediaEngine,
  getMediaEngineDiagnostic
};
