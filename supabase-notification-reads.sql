-- ============================================================================
-- notification_reads — per-subscriber read state for the user Notification Inbox
-- ----------------------------------------------------------------------------
-- Companion table to `notifications_history` (supabase-notifications-history.sql).
-- One row = "subscriber X has read notification Y". The SAME notification can be
-- read by many subscribers, so read state CANNOT be an `is_read` column on
-- notifications_history — it belongs in this join table.
--
-- Identity: `subscriber_id` is the OneSignal Web SDK Push Subscription id
-- (OneSignal.User.PushSubscription.id, resolved in
-- src/lib/onesignal-subscriber.ts) — the only stable, anonymous, per-device
-- identifier this app has. E3dady has no end-user accounts (the only auth in
-- the project is the admin password), so there is no user id to use instead.
--
-- HOW TO APPLY: paste this whole file into Supabase → SQL Editor → Run.
-- (Same manual process as supabase-attendance-migration.sql /
-- supabase-notifications-history.sql.)
--
-- Until it is applied, the inbox keeps working in device-local fallback mode
-- (localStorage) — the API reports readsSupported:false and nothing breaks.
--
-- notifications_history itself is NOT modified: no columns change, no
-- timestamp migration (sent_at/created_at stay TEXT), Admin History keeps
-- working exactly as before.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS notification_reads (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL,
  subscriber_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notification_reads_pkey PRIMARY KEY (id),

  CONSTRAINT notification_reads_notification_fkey
    FOREIGN KEY (notification_id)
    REFERENCES public.notifications_history (id)
    ON DELETE CASCADE,

  -- Idempotency: opening a notification twice can never create a second row;
  -- the second insert is silently ignored (ON CONFLICT DO NOTHING).
  CONSTRAINT notification_reads_unique
    UNIQUE (notification_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_notification
  ON notification_reads (notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_reads_subscriber
  ON notification_reads (subscriber_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Enabled with DELIBERATELY NO policies: anon and authenticated get nothing.
-- With no user authentication in this app, a client-side policy could not
-- prove WHICH subscriber a request belongs to, so the browser must never talk
-- to this table. Every read/write happens in the server API routes
-- (GET /api/notifications and POST /api/notifications/read), which use the
-- service-role key (RLS-bypassing). Result: no subscriber can read or modify
-- another subscriber's read-state, and notification history stays untouched.
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE notification_reads FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notification_reads TO service_role;
