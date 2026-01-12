-- Migration: create profiles, list_entries, reviews, notifications
-- Run this in Supabase SQL editor or via psql against your DB

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type_enum') THEN
    CREATE TYPE media_type_enum AS ENUM ('ANIME','MANGA');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'list_status_enum') THEN
    CREATE TYPE list_status_enum AS ENUM (
      'watching','completed','on_hold','dropped','plan_to_watch'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS list_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id integer NOT NULL,
  media_type media_type_enum NOT NULL,
  status list_status_enum NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  score integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_user_media UNIQUE (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_list_entries_user ON list_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_list_entries_media ON list_entries (media_id);

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id integer NOT NULL,
  rating smallint CHECK (rating IS NULL OR (rating >= 1 AND rating <= 10)),
  text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_user_media_review UNIQUE (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_media ON reviews (media_id);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);

-- Optional: simple trigger to keep updated_at current on updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers safely (drop if exist then create)
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_list_entries_updated_at ON list_entries;
CREATE TRIGGER trg_list_entries_updated_at
BEFORE UPDATE ON list_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- End of migration
