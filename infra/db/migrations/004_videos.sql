-- 004: Videos (mp4), kept separate from images.
-- Back up the DB before running: psql -v ON_ERROR_STOP=1 -f 004_videos.sql
BEGIN;

CREATE TABLE videos (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX videos_project_created_idx ON videos(project_id, created_at DESC);
CREATE INDEX videos_user_idx ON videos(user_id);

COMMIT;
-- Rollback: DROP TABLE videos;
