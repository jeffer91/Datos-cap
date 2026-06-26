const { getDatabase } = require('../sqliteConnection');

function nowIso() {
  return new Date().toISOString();
}

function createAnalysis(data) {
  const db = getDatabase();
  const payload = {
    local_id: data.local_id,
    video_local_id: data.video_local_id,
    analysis_mode: data.analysis_mode || 'local',
    status: data.status || 'pending',
    summary: data.summary || null,
    human_summary: data.human_summary || null,
    technical_summary: data.technical_summary || null,
    audio_path: data.audio_path || null,
    frames_folder_path: data.frames_folder_path || null,
    transcript_path: data.transcript_path || null,
    analysis_json_path: data.analysis_json_path || null,
    pdf_report_path: data.pdf_report_path || null,
    txt_report_path: data.txt_report_path || null,
    cut_count: data.cut_count || 0,
    average_cut_seconds: data.average_cut_seconds || null,
    frame_count: data.frame_count || 0,
    silence_count: data.silence_count || 0,
    music_event_count: data.music_event_count || 0,
    transcript_word_count: data.transcript_word_count || 0,
    hook_count: data.hook_count || 0,
    section_count: data.section_count || 0,
    error_message: data.error_message || null,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  db.prepare('INSERT INTO analyses (local_id, video_local_id, analysis_mode, status, summary, human_summary, technical_summary, audio_path, frames_folder_path, transcript_path, analysis_json_path, pdf_report_path, txt_report_path, cut_count, average_cut_seconds, frame_count, silence_count, music_event_count, transcript_word_count, hook_count, section_count, error_message, created_at, updated_at) VALUES (@local_id, @video_local_id, @analysis_mode, @status, @summary, @human_summary, @technical_summary, @audio_path, @frames_folder_path, @transcript_path, @analysis_json_path, @pdf_report_path, @txt_report_path, @cut_count, @average_cut_seconds, @frame_count, @silence_count, @music_event_count, @transcript_word_count, @hook_count, @section_count, @error_message, @created_at, @updated_at)').run(payload);

  return findAnalysisByLocalId(payload.local_id);
}

function updateAnalysis(localId, changes = {}) {
  const existing = findAnalysisByLocalId(localId);
  if (!existing) throw new Error(`No existe el análisis con local_id: ${localId}`);

  const payload = { ...existing, ...changes, local_id: localId, updated_at: nowIso() };
  getDatabase().prepare('UPDATE analyses SET analysis_mode=@analysis_mode, status=@status, summary=@summary, human_summary=@human_summary, technical_summary=@technical_summary, audio_path=@audio_path, frames_folder_path=@frames_folder_path, transcript_path=@transcript_path, analysis_json_path=@analysis_json_path, pdf_report_path=@pdf_report_path, txt_report_path=@txt_report_path, cut_count=@cut_count, average_cut_seconds=@average_cut_seconds, frame_count=@frame_count, silence_count=@silence_count, music_event_count=@music_event_count, transcript_word_count=@transcript_word_count, hook_count=@hook_count, section_count=@section_count, error_message=@error_message, updated_at=@updated_at WHERE local_id=@local_id').run(payload);

  return findAnalysisByLocalId(localId);
}

function findAnalysisByLocalId(localId) {
  return getDatabase().prepare('SELECT * FROM analyses WHERE local_id = ? LIMIT 1').get(localId);
}

function listAnalysesByVideo(videoLocalId) {
  return getDatabase().prepare('SELECT * FROM analyses WHERE video_local_id = ? ORDER BY created_at DESC').all(videoLocalId);
}

function listAnalyses() {
  return getDatabase().prepare('SELECT * FROM analyses ORDER BY created_at DESC').all();
}

function replaceTechnicalEvents(analysisLocalId, events = []) {
  const db = getDatabase();
  db.prepare('DELETE FROM technical_events WHERE analysis_local_id = ?').run(analysisLocalId);

  const insert = db.prepare('INSERT INTO technical_events (analysis_local_id, event_type, event_label, start_time, end_time, start_seconds, end_seconds, confidence, details_json) VALUES (@analysis_local_id, @event_type, @event_label, @start_time, @end_time, @start_seconds, @end_seconds, @confidence, @details_json)');

  events.forEach((event) => {
    insert.run({
      analysis_local_id: analysisLocalId,
      event_type: event.event_type,
      event_label: event.event_label || null,
      start_time: event.start_time || null,
      end_time: event.end_time || null,
      start_seconds: event.start_seconds ?? null,
      end_seconds: event.end_seconds ?? null,
      confidence: event.confidence ?? null,
      details_json: event.details_json ? JSON.stringify(event.details_json) : null
    });
  });

  return listTechnicalEvents(analysisLocalId);
}

function listTechnicalEvents(analysisLocalId) {
  return getDatabase().prepare('SELECT * FROM technical_events WHERE analysis_local_id = ? ORDER BY start_seconds ASC, id ASC').all(analysisLocalId);
}

function replaceSections(analysisLocalId, sections = []) {
  const db = getDatabase();
  db.prepare('DELETE FROM analysis_sections WHERE analysis_local_id = ?').run(analysisLocalId);

  const insert = db.prepare('INSERT INTO analysis_sections (analysis_local_id, section_order, section_type, section_title, start_time, end_time, start_seconds, end_seconds, description, script_intention, visual_strategy, audio_strategy, retention_strategy) VALUES (@analysis_local_id, @section_order, @section_type, @section_title, @start_time, @end_time, @start_seconds, @end_seconds, @description, @script_intention, @visual_strategy, @audio_strategy, @retention_strategy)');

  sections.forEach((section, index) => {
    insert.run({
      analysis_local_id: analysisLocalId,
      section_order: section.section_order ?? index + 1,
      section_type: section.section_type || null,
      section_title: section.section_title || null,
      start_time: section.start_time || null,
      end_time: section.end_time || null,
      start_seconds: section.start_seconds ?? null,
      end_seconds: section.end_seconds ?? null,
      description: section.description || null,
      script_intention: section.script_intention || null,
      visual_strategy: section.visual_strategy || null,
      audio_strategy: section.audio_strategy || null,
      retention_strategy: section.retention_strategy || null
    });
  });

  return listSections(analysisLocalId);
}

function listSections(analysisLocalId) {
  return getDatabase().prepare('SELECT * FROM analysis_sections WHERE analysis_local_id = ? ORDER BY section_order ASC').all(analysisLocalId);
}

function countAnalyses() {
  return getDatabase().prepare('SELECT COUNT(*) AS total FROM analyses').get().total;
}

module.exports = {
  createAnalysis,
  updateAnalysis,
  findAnalysisByLocalId,
  listAnalysesByVideo,
  listAnalyses,
  replaceSections,
  listSections,
  replaceTechnicalEvents,
  listTechnicalEvents,
  countAnalyses
};
