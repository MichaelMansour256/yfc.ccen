-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create notifications_history table
CREATE TABLE IF NOT EXISTS notifications_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sent_at TEXT NOT NULL,
  heading_ar TEXT NOT NULL DEFAULT '',
  heading_en TEXT NOT NULL DEFAULT '',
  message_ar TEXT NOT NULL DEFAULT '',
  message_en TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '/ar',
  image TEXT,
  onesignal_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  recipients INTEGER,
  created_at TEXT NOT NULL,
  error TEXT
);

-- Create index for faster queries by sent_at
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications_history(sent_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE notifications_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read/write
-- Adjust this based on your needs. For admin-only API access via service role,
-- you might want stricter policies.
CREATE POLICY "Authenticated users can manage notifications" ON notifications_history
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Grant access to service role (for backend/server-side operations)
-- This allows your API routes to insert/select without RLS restrictions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications_history TO service_role;
