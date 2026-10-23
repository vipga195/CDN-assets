-- 003: CMS content types + entries (project-scoped).
-- Back up the DB before running: psql -v ON_ERROR_STOP=1 -f 003_cms_content.sql
BEGIN;

CREATE TABLE content_types (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  api_id TEXT NOT NULL CHECK (api_id ~ '^[a-zA-Z][a-zA-Z0-9_]{0,63}$'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  display_field TEXT,                         -- field id, validated by the API
  fields JSONB NOT NULL DEFAULT '[]'
    CHECK (jsonb_typeof(fields) = 'array'),   -- [{id,name,type,required,refTypeId?}]
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, api_id)
);

CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_type_id BIGINT NOT NULL REFERENCES content_types(id) ON DELETE RESTRICT,
  data JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object'),  -- working draft
  published_data JSONB CHECK (jsonb_typeof(published_data) = 'object'),    -- snapshot; NULL = not published
  version INT NOT NULL DEFAULT 1,             -- optimistic locking
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  CHECK ((published_at IS NULL) = (published_data IS NULL))
);
CREATE INDEX entries_project_updated_idx ON entries(project_id, updated_at DESC, id DESC);
CREATE INDEX entries_type_updated_idx ON entries(content_type_id, updated_at DESC, id DESC);

COMMIT;
-- Rollback: DROP TABLE entries, content_types;