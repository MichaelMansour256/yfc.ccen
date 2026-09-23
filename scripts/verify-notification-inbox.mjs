// Verification suite for the Notification Inbox read-state feature (spec tests
// A/C/D/E/F/G). Re-runnable and self-cleaning: waits up to 150s for
// supabase-notification-reads.sql to be applied, exercises the API matrix
// against a locally running server (npm start → http://localhost:3000),
// deletes every artifact it creates (temp failed row + fake-subscriber reads),
// exits 0 = all passed, 1 = failures, 2 = migration not detected.
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const pick = (name) => {
  const m = env.match(new RegExp("^" + name + "=.*$", "m"));
  if (!m) throw new Error("missing " + name);
  return m[0].slice(name.length + 1).trim();
};
const SUPA = pick("NEXT_PUBLIC_SUPABASE_URL");
const KEY = pick("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN = pick("ADMIN_PASSWORD");
const BASE = "http://localhost:3000";
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

const SUB1 = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"; // fake device A
const SUB2 = "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee"; // fake device B
const REAL_ID = "19311087-8020-4b12-a976-705c779b9459"; // existing sent row
const FAILED_ID = "11111111-2222-4333-8444-555555555555"; // temp failed row

const json = async (r) => {
  try {
    return await r.json();
  } catch {
    return null;
  }
};
const get = async (u, init) => {
  const r = await fetch(u, init);
  return { status: r.status, body: await json(r) };
};
const post = (u, body) =>
  get(u, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const countReads = async (sub, notifId) => {
  let q = `${SUPA}/rest/v1/notification_reads?select=id&subscriber_id=eq.${sub}`;
  if (notifId) q += `&notification_id=eq.${notifId}`;
  const r = await fetch(q, { headers: H });
  const rows = await r.json();
  return r.ok ? rows.length : -1;
};

const out = {};
const eq = (name, actual, expected) => {
  out[name] = { actual, expected, pass: JSON.stringify(actual) === JSON.stringify(expected) };
};

// ── Phase 1: wait for the migration (Supabase reloads its schema cache on DDL) ──
const deadline = Date.now() + 150_000;
let applied = false;
while (Date.now() < deadline) {
  const r = await fetch(`${SUPA}/rest/v1/notification_reads?select=id&limit=1`, { headers: H });
  if (r.ok) {
    applied = true;
    break;
  }
  await new Promise((res) => setTimeout(res, 3000));
}
if (!applied) {
  console.log("TIMEOUT_WAITING_FOR_MIGRATION");
  process.exit(2);
}
console.log("migration detected — running tests\n");

try {
  // ── Test A: existing notification visible, empty read-state, exact unread ──
  let r = await get(`${BASE}/api/notifications?limit=5&subscriber=${SUB1}`);
  eq("A.list_readsSupported", r.body?.readsSupported, true);
  eq("A.list_count", r.body?.notifications?.length, 4);
  eq("A.list_readIds", r.body?.readIds, []);
  eq("A.list_unreadCount", r.body?.unreadCount, 4);
  eq("A.no_internal_fields", (r.body?.notifications ?? []).some(
    (n) => "onesignal_id" in n || "error" in n || "recipients" in n || "status" in n
  ), false);


  // ── Test C: mark one read → row created, count drops, idempotent on repeat ──
  r = await post(`${BASE}/api/notifications/read`, { subscriber: SUB1, notificationId: REAL_ID });
  eq("C.mark1st", r.body, { ok: true, marked: 1 });
  r = await get(`${BASE}/api/notifications?limit=5&subscriber=${SUB1}`);
  eq("C.readIds_after", r.body?.readIds, [REAL_ID]);
  eq("C.unread_after", r.body?.unreadCount, 3);
  r = await post(`${BASE}/api/notifications/read`, { subscriber: SUB1, notificationId: REAL_ID });
  eq("C.mark2nd_idempotent", r.body, { ok: true, marked: 0 });
  eq("C.db_rows_for_sub1", await countReads(SUB1), 1); // unique constraint: exactly one row

  // ── Test D: second subscriber unaffected by device A's reads ──
  r = await get(`${BASE}/api/notifications?limit=5&subscriber=${SUB2}`);
  eq("D.sub2_unread", r.body?.unreadCount, 4);
  eq("D.sub2_readIds", r.body?.readIds, []);

  // ── Test E: mark-all affects ONLY the calling subscriber ──
  r = await post(`${BASE}/api/notifications/read`, { subscriber: SUB2, all: true });
  eq("E.sub2_markAll", r.body, { ok: true, marked: 4 });
  r = await get(`${BASE}/api/notifications?limit=5&subscriber=${SUB2}`);
  eq("E.sub2_unread_after", r.body?.unreadCount, 0);
  r = await get(`${BASE}/api/notifications?limit=5&subscriber=${SUB1}`);
  eq("E.sub1_unread_untouched", r.body?.unreadCount, 3); // device A kept its state
  eq("E.db_rows_for_sub2", await countReads(SUB2), 4);

  // ── Test F: failed notifications never listed, never markable ──
  const now = new Date().toISOString();
  const ins = await fetch(`${SUPA}/rest/v1/notifications_history`, {
    method: "POST",
    headers: { ...H, "content-type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      id: FAILED_ID, sent_at: now, created_at: now,
      heading_ar: "TEMP", heading_en: "TEMP", message_ar: "TEMP", message_en: "TEMP",
      status: "failed_error",
    }),
  });
  eq("F.insert_failed_row", ins.status, 201);
  r = await get(`${BASE}/api/notifications?limit=50`);
  eq("F.failed_hidden_from_list", (r.body?.notifications ?? []).some((n) => n.id === FAILED_ID), false);
  r = await post(`${BASE}/api/notifications/read`, { subscriber: SUB1, notificationId: FAILED_ID });
  eq("F.failed_mark_rejected", r.body, { ok: true, marked: 0 });
  eq("F.no_read_row_for_failed", await countReads(SUB1, FAILED_ID), 0);

  // ── Test G: Admin regression — history endpoint unchanged ──
  r = await get(`${BASE}/api/admin/notifications`, {
    headers: { "x-admin-password": ADMIN },
  });
  eq("G.admin_history_status", r.status, 200);
  eq("G.admin_history_source", r.body?.source, "supabase");
  eq("G.admin_history_count", (r.body?.notifications ?? []).length >= 4, true);
} finally {
  // ── Cleanup: remove every artifact this script created ──
  const delFailed = await fetch(`${SUPA}/rest/v1/notifications_history?id=eq.${FAILED_ID}`, {
    method: "DELETE", headers: H,
  });
  const delReads = await fetch(
    `${SUPA}/rest/v1/notification_reads?subscriber_id=in.("${SUB1}","${SUB2}")`,
    { method: "DELETE", headers: H }
  );
  out.__cleanup = { failedRowDeleted: delFailed.status, readsDeleted: delReads.status };
}

const fails = Object.entries(out).filter(([k, v]) => v.pass === false);
console.log(JSON.stringify(out, null, 2));
console.log(fails.length === 0 ? "\nALL TESTS PASSED" : `\n${fails.length} FAILED: ${fails.map(([k]) => k).join(", ")}`);
process.exit(fails.length === 0 ? 0 : 1);
