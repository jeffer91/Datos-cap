const { getDatabase } = require('../sqliteConnection');

function nowIso() {
  return new Date().toISOString();
}

function createVideo(videoData) {
  const db = getDatabase();

  const payload = {
    local_id: videoData.local_id,
    original_name: videoData.original_name,
    stored_name: videoData.stored_name || null,
    creator_name: videoData.creator_name || null,
    style_name: videoData.style_name,
    topic: videoData.topic || null,
    objective: videoData.objective || null,
    source_path: videoData.source_path || null,
    local_video_path: videoData.local_video_path || null,
    duration_seconds: videoData.duration_seconds || null,
    fps: videoData.fps || null,
    width: videoData.width || null,
    height: videoData.height || null,
    format: videoData.format || null,
    status: videoData.status || 'imported',
    notes: videoData.notes || null,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  db.prepare(
    `
    INSERT INTO videos (
      local_id,
      original_name,
      stored_name,
      creator_name,
      style_name,
      topic,
      objective,
      source_path,
      local_video_path,
      duration_seconds,
      fps,
      width,
      height,
      format,
      status,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      @local_id,
      @original_name,
      @stored_name,
      @creator_name,
      @style_name,
      @topic,
      @objective,
      @source_path,
      @local_video_path,
      @duration_seconds,
      @fps,
      @width,
      @height,
      @format,
      @status,
      @notes,
      @created_at,
      @updated_at
    )
    `
  ).run(payload);

  return findVideoByLocalId(payload.local_id);
}

function updateVideo(localId, changes = {}) {
  const db = getDatabase();

  const existing = findVideoByLocalId(localId);

  if (!existing) {
    throw new Error(`No existe el video con local_id: ${localId}`);
  }

  const payload = {
    local_id: localId,
    original_name: changes.original_name ?? existing.original_name,
    stored_name: changes.stored_name ?? existing.stored_name,
    creator_name: changes.creator_name ?? existing.creator_name,
    style_name: changes.style_name ?? existing.style_name,
    topic: changes.topic ?? existing.topic,
    objective: changes.objective ?? existing.objective,
    source_path: changes.source_path ?? existing.source_path,
    local_video_path: changes.local_video_path ?? existing.local_video_path,
    duration_seconds: changes.duration_seconds ?? existing.duration_seconds,
    fps: changes.fps ?? existing.fps,
    width: changes.width ?? existing.width,
    height: changes.height ?? existing.height,
    format: changes.format ?? existing.format,
    status: changes.status ?? existing.status,
    notes: changes.notes ?? existing.notes,
    updated_at: nowIso()
  };

  db.prepare(
    `
    UPDATE videos
    SET
      original_name = @original_name,
      stored_name = @stored_name,
      creator_name = @creator_name,
      style_name = @style_name,
      topic = @topic,
      objective = @objective,
      source_path = @source_path,
      local_video_path = @local_video_path,
      duration_seconds = @duration_seconds,
      fps = @fps,
      width = @width,
      height = @height,
      format = @format,
      status = @status,
      notes = @notes,
      updated_at = @updated_at
    WHERE local_id = @local_id
    `
  ).run(payload);

  return findVideoByLocalId(localId);
}

function findVideoByLocalId(localId) {
  const db = getDatabase();

  return db
    .prepare(
      `
      SELECT *
      FROM videos
      WHERE local_id = ?
      LIMIT 1
      `
    )
    .get(localId);
}

function listVideos(filters = {}) {
  const db = getDatabase();

  const conditions = [];
  const params = {};

  if (filters.creator_name) {
    conditions.push('creator_name LIKE @creator_name');
    params.creator_name = `%${filters.creator_name}%`;
  }

  if (filters.style_name) {
    conditions.push('style_name = @style_name');
    params.style_name = filters.style_name;
  }

  if (filters.topic) {
    conditions.push('topic LIKE @topic');
    params.topic = `%${filters.topic}%`;
  }

  if (filters.status) {
    conditions.push('status = @status');
    params.status = filters.status;
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return db
    .prepare(
      `
      SELECT *
      FROM videos
      ${whereSql}
      ORDER BY created_at DESC
      `
    )
    .all(params);
}

function deleteVideo(localId) {
  const db = getDatabase();

  const result = db
    .prepare(
      `
      DELETE FROM videos
      WHERE local_id = ?
      `
    )
    .run(localId);

  return {
    ok: result.changes > 0,
    deleted: result.changes
  };
}

function countVideos() {
  const db = getDatabase();

  const result = db
    .prepare(
      `
      SELECT COUNT(*) AS total
      FROM videos
      `
    )
    .get();

  return result.total;
}

module.exports = {
  createVideo,
  updateVideo,
  findVideoByLocalId,
  listVideos,
  deleteVideo,
  countVideos
};
