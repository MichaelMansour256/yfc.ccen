// Notification history storage using Supabase
// Replaces the previous file-based storage (public/notifications-history.json)
// which doesn't work on Vercel/serverless (read-only filesystem)

import { supabase } from "./supabase";

/** Raw snake_case columns of a `notifications_history` row. */
interface NotificationHistoryRow {
  id: string;
  sent_at: string;
  heading_ar: string;
  heading_en: string;
  message_ar: string;
  message_en: string;
  url: string;
  image: string | null;
  onesignal_id: string | null;
  status: string;
  recipients: number | null;
  created_at: string;
  error: string | null;
}

/** Columns selected for the public inbox feed (deliberately narrower). */
interface PublicNotificationRow {
  id: string;
  sent_at: string;
  heading_ar: string;
  heading_en: string;
  message_ar: string;
  message_en: string;
  url: string;
  image: string | null;
}

export interface NotificationRecord {
  id: string;
  sentAt: string;
  headingAr: string;
  headingEn: string;
  messageAr: string;
  messageEn: string;
  url: string;
  image: string | null;
  onesignalId: string | null;
  status: "sent" | "failed_no_subscribers" | "failed_error" | string;
  recipients: number | null;
  createdAt: string;
  error?: string;
}

/**
 * Save a notification record to Supabase.
 */
export async function putNotificationRecord(
  record: Omit<NotificationRecord, "createdAt">
): Promise<void> {
  const { error } = await supabase
    .from("notifications_history")
    .insert({
      id: record.id,
      sent_at: record.sentAt,
      heading_ar: record.headingAr,
      heading_en: record.headingEn,
      message_ar: record.messageAr,
      message_en: record.messageEn,
      url: record.url,
      image: record.image,
      onesignal_id: record.onesignalId,
      status: record.status,
      recipients: record.recipients,
      error: record.error ?? null,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error(
      "Failed to save notification record to Supabase:",
      error
    );
    throw error;
  }
}

/**
 * Get all notification records, newest first.
 */
export async function getNotificationHistory(): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("notifications_history")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to fetch notification history from Supabase:", error);
    return [];
  }

  return (data || []).map((row: NotificationHistoryRow) => ({
    id: row.id,
    sentAt: row.sent_at,
    headingAr: row.heading_ar,
    headingEn: row.heading_en,
    messageAr: row.message_ar,
    messageEn: row.message_en,
    url: row.url,
    image: row.image,
    onesignalId: row.onesignal_id,
    status: row.status,
    recipients: row.recipients,
    createdAt: row.created_at,
    error: row.error ?? undefined,
  }));
}

/**
 * Get a single notification record by ID.
 */
export async function getNotificationById(
  id: string
): Promise<NotificationRecord | null> {
  const { data, error } = await supabase
    .from("notifications_history")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    sentAt: data.sent_at,
    headingAr: data.heading_ar,
    headingEn: data.heading_en,
    messageAr: data.message_ar,
    messageEn: data.message_en,
    url: data.url,
    image: data.image,
    onesignalId: data.onesignal_id,
    status: data.status,
    recipients: data.recipients,
    createdAt: data.created_at,
    error: data.error,
  };
}

/** Sanitized notification as served to the public user-facing inbox. */
export interface PublicNotification {
  id: string;
  sentAt: string;
  headingAr: string;
  headingEn: string;
  messageAr: string;
  messageEn: string;
  url: string;
  image: string | null;
}

/**
 * Paginated, sanitized notification list for the user notification inbox.
 *
 * Reads the SAME `notifications_history` table the Admin History tab uses —
 * one canonical source, no second notification store.
 *
 *   • only status="sent" rows are returned — failed attempts
 *     (failed_no_subscribers / failed_error) are never shown to users
 *   • internal fields (onesignal_id, error, recipients) are deliberately
 *     excluded; the returned content is exactly what OneSignal already
 *     pushed to every subscriber's device
 *   • ordered newest-first on the indexed sent_at column
 *
 * `limit`/`offset` pagination: one extra row is fetched so the caller can
 * detect `hasMore` without a separate count query.
 */
export async function listPublicNotifications(
  limit = 20,
  offset = 0
): Promise<{ notifications: PublicNotification[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from("notifications_history")
    .select(
      "id, sent_at, heading_ar, heading_en, message_ar, message_en, url, image"
    )
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    console.error(
      "Failed to fetch public notifications from Supabase:",
      error
    );
    throw error;
  }

  const rows = (data || []) as PublicNotificationRow[];
  return {
    notifications: rows.slice(0, limit).map((row) => ({
      id: row.id,
      sentAt: row.sent_at,
      headingAr: row.heading_ar,
      headingEn: row.heading_en,
      messageAr: row.message_ar,
      messageEn: row.message_en,
      url: row.url,
      image: row.image,
    })),
    hasMore: rows.length > limit,
  };
}

