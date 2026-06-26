function secondsToSimpleTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalSeconds = Math.floor(safeSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function detectPossibleMusicCues({ audioRhythm = null }) {
  if (!audioRhythm || !audioRhythm.speechSegments) {
    return { ok: true, cueCount: 0, cues: [], technicalEvents: [], note: 'No hay suficientes datos de audio.' };
  }

  const cues = audioRhythm.speechSegments
    .filter((segment) => segment.duration_seconds >= 25)
    .map((segment, index) => ({
      cue_index: index + 1,
      start_seconds: segment.start_seconds,
      end_seconds: segment.end_seconds,
      start_time: secondsToSimpleTime(segment.start_seconds),
      end_time: secondsToSimpleTime(segment.end_seconds),
      duration_seconds: segment.duration_seconds,
      cue_type: 'possible_continuous_sound_or_music_bed',
      confidence: 0.35,
      note: 'Inferencia básica: bloque largo con pocas pausas.'
    }));

  const technicalEvents = cues.map((cue) => ({
    event_type: 'possible_music_or_continuous_sound',
    event_label: `Posible sonido continuo ${cue.cue_index}`,
    start_time: cue.start_time,
    end_time: cue.end_time,
    start_seconds: cue.start_seconds,
    end_seconds: cue.end_seconds,
    confidence: cue.confidence,
    details_json: { cueType: cue.cue_type, durationSeconds: cue.duration_seconds, note: cue.note }
  }));

  return { ok: true, cueCount: cues.length, cues, technicalEvents, note: 'Detector heurístico de zonas continuas.' };
}

module.exports = { detectPossibleMusicCues };
