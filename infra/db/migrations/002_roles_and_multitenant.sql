-- 002: system roles + multi-tenant schema (plans > accounts > projects > members, API keys,
-- draft/published images, aliases, per-key usage).
-- Expand step only: users.quota_bytes / users.used_bytes and images.user_id are kept so the
-- current API keeps working. Drop them in a later migration once the API reads accounts/projects.
-- Idempotent enough to run once on an existing DB (psql -v ON_ERROR_STOP=1 -f ...); it has its own BEGIN/COMMIT.
BEGIN;

-- System role (platform admin), separate from per-project roles.
-- IF NOT EXISTS: fresh installs already get these from init.sql.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;

-- Plans: limits are placeholders, tune per plan. NULL = unlimited.
CREATE TABLE plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_projects INT,
  max_storage_bytes BIGINT,
  max_members_per_project INT,
  key_rate_limit_rps INT,                 -- default per-key request rate
  key_bandwidth_bytes_month BIGINT        -- default per-key egress per month
);
INSERT INTO plans (code, name, max_projects, max_storage_bytes, max_members_per_project,
                   key_rate_limit_rps, key_bandwidth_bytes_month)
VALUES ('default', 'Default', 10, 53687091200, 10, 20, NULL);

-- Account = the billing/quota unit owned by one user; projects share its storage quota.
CREATE TABLE accounts (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  quota_override_bytes BIGINT CHECK (quota_override_bytes >= 0), -- admin override; NULL = plan value
  used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_owner_idx ON accounts(owner_user_id);

CREATE TABLE projects (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);

CREATE TABLE project_members (
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user_idx ON project_members(user_id);

-- Images: project becomes the owner; user_id stays as uploader and file-path component.
ALTER TABLE images
  ADD COLUMN project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  ADD COLUMN content_sha256 BYTEA CHECK (octet_length(content_sha256) = 32),
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: every existing user -> one default account + one "Default" project (user = admin).
INSERT INTO accounts (owner_user_id, plan_code, quota_override_bytes, used_bytes)
  SELECT id, 'default', quota_bytes, used_bytes FROM users;
INSERT INTO projects (account_id, name) SELECT id, 'Default' FROM accounts;
INSERT INTO project_members (project_id, user_id, role)
  SELECT p.id, a.owner_user_id, 'admin'
  FROM projects p JOIN accounts a ON a.id = p.account_id;
UPDATE images i SET project_id = p.id
  FROM projects p JOIN accounts a ON a.id = p.account_id
  WHERE a.owner_user_id = i.user_id;
ALTER TABLE images ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX images_project_created_idx ON images(project_id, created_at DESC);
CREATE INDEX images_project_updated_idx ON images(project_id, updated_at);
CREATE INDEX images_project_status_idx ON images(project_id, status);
CREATE INDEX images_project_sha_idx ON images(project_id, content_sha256); -- dedup for bulk upload

-- Alias -> image pointer, unique per project. A separate table lets "upsert" repoint an alias to
-- a new immutable image (new UUID, old URLs stay valid) and still supports in-place update.
CREATE TABLE image_aliases (
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias TEXT NOT NULL CHECK (alias ~ '^[a-z0-9][a-z0-9._-]{0,127}$'),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, alias)
);
CREATE INDEX image_aliases_image_idx ON image_aliases(image_id);

-- API keys belong to the project; only the SHA-256 of the key is stored.
CREATE TABLE api_keys (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,                       -- first chars of the key, for display only
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{read}' CHECK (scopes <@ ARRAY['read', 'write']),
  rate_limit_rps INT,                         -- NULL = plan default
  bandwidth_limit_bytes_month BIGINT,         -- NULL = plan default
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX api_keys_project_idx ON api_keys(project_id);

-- Monthly usage per key, for the bandwidth cap (rate limiting itself is in-memory / nginx).
CREATE TABLE api_key_usage (
  key_id BIGINT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  period DATE NOT NULL,                       -- first day of the month (UTC)
  requests BIGINT NOT NULL DEFAULT 0,
  bytes_out BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (key_id, period)
);

COMMIT;
