PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  description TEXT,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_id TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  stored_name TEXT,
  creator_name TEXT,
  style_name TEXT NOT NULL,
  topic TEXT,
  objective TEXT,
  source_path TEXT,
  local_video_path TEXT,
  duration_seconds REAL,
  fps REAL,
  width INTEGER,
  height INTEGER,
  format TEXT,
  status TEXT NOT NULL DEFAULT 'imported',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_creator_name ON videos (creator_name);
CREATE INDEX IF NOT EXISTS idx_videos_style_name ON videos (style_name);
CREATE INDEX IF NOT EXISTS idx_videos_topic ON videos (topic);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos (status);

CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_id TEXT NOT NULL UNIQUE,
  video_local_id TEXT NOT NULL,
  analysis_mode TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  human_summary TEXT,
  technical_summary TEXT,
  audio_path TEXT,
  frames_folder_path TEXT,
  transcript_path TEXT,
  analysis_json_path TEXT,
  pdf_report_path TEXT,
  txt_report_path TEXT,
  cut_count INTEGER DEFAULT 0,
  average_cut_seconds REAL,
  frame_count INTEGER DEFAULT 0,
  silence_count INTEGER DEFAULT 0,
  music_event_count INTEGER DEFAULT 0,
  transcript_word_count INTEGER DEFAULT 0,
  hook_count INTEGER DEFAULT 0,
  section_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_local_id) REFERENCES videos (local_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analyses_video_local_id ON analyses (video_local_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses (status);
CREATE INDEX IF NOT EXISTS idx_analyses_mode ON analyses (analysis_mode);

CREATE TABLE IF NOT EXISTS analysis_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_local_id TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  section_type TEXT,
  section_title TEXT,
  start_time TEXT,
  end_time TEXT,
  start_seconds REAL,
  end_seconds REAL,
  description TEXT,
  script_intention TEXT,
  visual_strategy TEXT,
  audio_strategy TEXT,
  retention_strategy TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_local_id) REFERENCES analyses (local_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_sections_analysis ON analysis_sections (analysis_local_id);

CREATE TABLE IF NOT EXISTS technical_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_local_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_label TEXT,
  start_time TEXT,
  end_time TEXT,
  start_seconds REAL,
  end_seconds REAL,
  confidence REAL,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_local_id) REFERENCES analyses (local_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_technical_events_analysis ON technical_events (analysis_local_id);
CREATE INDEX IF NOT EXISTS idx_technical_events_type ON technical_events (event_type);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_id TEXT NOT NULL UNIQUE,
  template_name TEXT NOT NULL,
  style_name TEXT NOT NULL,
  description TEXT,
  source_creator_names TEXT,
  source_video_ids TEXT,
  source_analysis_ids TEXT,
  template_json_path TEXT,
  template_txt_path TEXT,
  pdf_report_path TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_style_name ON templates (style_name);

CREATE TABLE IF NOT EXISTS comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_id TEXT NOT NULL UNIQUE,
  comparison_name TEXT NOT NULL,
  style_name TEXT,
  video_ids TEXT,
  analysis_ids TEXT,
  summary TEXT,
  comparison_json_path TEXT,
  comparison_txt_path TEXT,
  pdf_report_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comparisons_style_name ON comparisons (style_name);
