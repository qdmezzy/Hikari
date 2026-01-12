-- Migration: RLS policies for profiles, list_entries, reviews, notifications
-- Apply this after running 001_create_supabase_tables.sql

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policy
DROP POLICY IF EXISTS profiles_self ON profiles;
CREATE POLICY profiles_self ON profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- List entries policy
DROP POLICY IF EXISTS list_entries_self ON list_entries;
CREATE POLICY list_entries_self ON list_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Reviews policy
DROP POLICY IF EXISTS reviews_self ON reviews;
CREATE POLICY reviews_self ON reviews
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications policy
DROP POLICY IF EXISTS notifications_self ON notifications;
CREATE POLICY notifications_self ON notifications
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notes:
-- - Use the `anon` key in client code; RLS will ensure users only access their rows.
-- - Use the `service_role` key for server-side jobs that need to bypass RLS.
