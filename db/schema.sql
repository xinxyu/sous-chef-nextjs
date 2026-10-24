-- Same schema as the Flask app's SQLAlchemy models, so an existing database works as-is.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY,
  username       VARCHAR(255) NOT NULL UNIQUE,
  email          VARCHAR(255),
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  google_sub     VARCHAR(255) UNIQUE
);

-- Legacy databases created before these columns existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE;

CREATE TABLE IF NOT EXISTS saved_recipes (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL,
  saved_at  TIMESTAMPTZ NOT NULL,
  title     TEXT,
  data      JSONB NOT NULL,
  PRIMARY KEY (user_id, recipe_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_saved_at ON saved_recipes (user_id, saved_at);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token      VARCHAR(255) PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token      VARCHAR(255) PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
