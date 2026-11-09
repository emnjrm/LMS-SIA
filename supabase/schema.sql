-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Tables (if they don't already exist)
CREATE TABLE IF NOT EXISTS u (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  r CHAR(1) NOT NULL, -- 't' for Admin/Teacher, 's' for Student
  n VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS c (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nm VARCHAR(100),
  t_id UUID REFERENCES u(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS a (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  c_id UUID REFERENCES c(id) ON DELETE CASCADE,
  ttl VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS s (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  a_id UUID REFERENCES a(id) ON DELETE CASCADE,
  u_id UUID REFERENCES u(id) ON DELETE CASCADE,
  pth TEXT -- Path to the file in Supabase storage bucket 'b'
);

-- 2. Clear any existing placeholder data so the database starts 100% clean
TRUNCATE TABLE s, a, c, u CASCADE;

-- 3. Fix Row-Level Security (RLS) policies on tables u, c, a, s
-- Enable RLS and grant full public access policies so the app can read/write via anon key
ALTER TABLE u ENABLE ROW LEVEL SECURITY;
ALTER TABLE c ENABLE ROW LEVEL SECURITY;
ALTER TABLE a ENABLE ROW LEVEL SECURITY;
ALTER TABLE s ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on u" ON u;
CREATE POLICY "Allow all operations on u" ON u FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on c" ON c;
CREATE POLICY "Allow all operations on c" ON c FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on a" ON a;
CREATE POLICY "Allow all operations on a" ON a FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on s" ON s;
CREATE POLICY "Allow all operations on s" ON s FOR ALL TO public USING (true) WITH CHECK (true);

-- 4. Initialize Storage Bucket 'b' and Storage RLS Policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('b', 'b', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Access to bucket b" ON storage.objects;
CREATE POLICY "Public Access to bucket b"
ON storage.objects FOR ALL
TO public
USING (bucket_id = 'b')
WITH CHECK (bucket_id = 'b');
