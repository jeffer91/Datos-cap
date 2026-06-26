function secondsToTranscriptTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalSeconds = Math.floor(safeSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function buildTranscriptDraftText({ videoName, creatorName, styleName, topic, speechSegments = [] }) {
  const lines = [];
  lines.push('VIDEO_AUDITOR_TRANSCRIPT_DRAFT');
  lines.push('');
  lines.push(`video_name: ${videoName || 'Sin nombre'}`);
  lines.push(`creator_name: ${creatorName || 'Sin creador'}`);
  lines.push(`style_name: ${styleName || 'Sin estilo'}`);
  lines.push(`topic: ${topic || 'Sin tema'}`);
  lines.push(`generated_at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('[SEGMENTS]');

  if (!speechSegments.length) {
    lines.push('No se detectaron segmentos suficientes.');
    return lines.join('\n');
  }

  speechSegments.forEach((segment, index) => {
    const start = secondsToTranscriptTime(segment.start_seconds);
    const end = secondsToTranscriptTime(segment.end_seconds);
    lines.push('');
    lines.push(`[${index + 1}] ${start} - ${end}`);
    lines.push('text: (pendiente de transcripción automática)');
    lines.push(`duration_seconds: ${segment.duration_seconds}`);
  });

  return lines.join('\n');
}

function buildTranscriptDraftJson({ analysisLocalId, videoLocalId, videoName, creatorName, styleName, topic, speechSegments = [] }) {
  return {
    type: 'transcript_draft',
    status: 'pending_stt_engine',
    analysisLocalId,
    videoLocalId,
    videoName,
    creatorName,
    styleName,
    topic,
    generatedAt: new Date().toISOString(),
    segments: speechSegments.map((segment, index) => ({
      index: index + 1,
      start_seconds: segment.start_seconds,
      end_seconds: segment.end_seconds,
      start_time: secondsToTranscriptTime(segment.start_seconds),
      end_time: secondsToTranscriptTime(segment.end_seconds),
      duration_seconds: segment.duration_seconds,
      text: ''
    }))
  };
}

module.exports = { secondsToTranscriptTime, buildTranscriptDraftText, buildTranscriptDraftJson };
