import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Prefers SUPABASE_SERVICE_ROLE_KEY (a server-only secret) so attendance
 * writes and reads can never be performed with a publishable key — this is
 * what makes supabase-attendance-lockdown.sql possible: once that migration
 * revokes the public check-in RPC from anon/authenticated, the ONLY way to
 * record attendance is through this server (POST /api/attendance/checkin,
 * which requires the admin/servant password).
 *
 * The secret is VALIDATED before use — only accepted when it is:
 *   • a legacy Supabase JWT whose payload role is "service_role", or
 *   • a new-format secret key ("sb_secret_…").
 * Anything else (a password pasted by mistake, a truncated value, an empty
 * string) is IGNORED with a warning and the app falls back to the other key,
 * so a bad value can never take the whole app down with "Invalid API key".
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function pickServerKey(): string | null {
  const candidate = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!candidate) return null;

  if (candidate.startsWith("sb_secret_")) return candidate;

  const parts = candidate.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      );
      if (payload?.role === "service_role") return candidate;
    } catch {
      /* not a parsable JWT — fall through to the rejection below */
    }
  }

  console.warn(
    "[supabase] SUPABASE_SERVICE_ROLE_KEY is set but does NOT look like a Supabase service " +
      'secret (expected a service_role JWT or an "sb_secret_…" key) — ignoring it and falling ' +
      "back to the publishable key. Copy the value from Supabase → Project Settings → API keys."
  );
  return null;
}

const serverSecret = pickServerKey();
const supabaseKey = serverSecret ?? fallbackKey;

if (typeof window === "undefined" && !serverSecret) {
  console.warn(
    "[supabase] No valid SUPABASE_SERVICE_ROLE_KEY configured — server routes use the " +
      "publishable/secret key from NEXT_PUBLIC_SUPABASE_ANON_KEY. Set the service key " +
      "(Supabase → Project Settings → API keys) and apply supabase-attendance-lockdown.sql " +
      "to lock attendance down to staff-only."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
