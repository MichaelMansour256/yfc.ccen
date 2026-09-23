/**
 * Admin authentication for the attendance section.
 *
 * The project's existing admin auth is stateless: the browser sends the admin
 * password in an `x-admin-password` header and every /api/admin/* route checks
 * it with `isAuthorized()` (src/lib/auth.ts). The main /admin page keeps that
 * password in React state, which is lost on navigation — so the attendance
 * section also stores it in localStorage, and *only after* it has been verified
 * against /api/admin/auth.
 *
 * Nothing here replaces server-side checks: every attendance API route
 * re-validates the password on each request and the database enforces the real
 * rules (RLS + UNIQUE(meeting_id, member_id)).
 */
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Shared with the main /admin page so one login unlocks both. */
export const ADMIN_PASSWORD_STORAGE_KEY = "admin_password";

export type AdminAuthStatus = "checking" | "anonymous" | "authenticated";

export interface AdminAuth {
  password: string;
  status: AdminAuthStatus;
  authed: boolean;
  /** Login error, ready to display (Arabic). */
  error: string | null;
  pending: boolean;
  headers: Record<string, string>;
  jsonHeaders: Record<string, string>;
  login: (candidate: string) => Promise<boolean>;
  logout: () => void;
}

export function useAdminAuth(): AdminAuth {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AdminAuthStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Read the stored password in an effect (not during render) so the server and
  // the first client render agree on the "checking" state — no hydration mismatch.
  useEffect(() => {
    let stored = "";
    try {
      stored = window.localStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) ?? "";
    } catch {
      stored = "";
    }
    if (stored) {
      setPassword(stored);
      setStatus("authenticated");
    } else {
      setStatus("anonymous");
    }
  }, []);

  const login = useCallback(async (candidate: string) => {
    const value = candidate.trim();
    if (!value) {
      setError("أدخل كلمة المرور");
      return false;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "x-admin-password": value },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("كلمة المرور غير صحيحة");
        return false;
      }
      if (!res.ok) {
        setError("تعذّر التحقق من كلمة المرور. حاول مرة أخرى.");
        return false;
      }
      window.localStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, value);
      setPassword(value);
      setStatus("authenticated");
      return true;
    } catch {
      setError("تعذّر الاتصال بالخادم");
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY);
    } catch {
      /* ignore private-mode failures */
    }
    setPassword("");
    setStatus("anonymous");
  }, []);

  const authed = status === "authenticated";

  // Memoised so `request()` keeps a stable identity between renders and fetch
  // effects never loop.
  const headers = useMemo(
    () => {
      const headers: Record<string, string> = {};
      if (authed) {
        headers["x-admin-password"] = password;
      }
      return headers;
    },
    [authed, password]
  );
  const jsonHeaders = useMemo(
    () => {
      const headers: Record<string, string> = {};
      if (authed) {
        headers["x-admin-password"] = password;
        headers["content-type"] = "application/json";
      }
      return headers;
    },
    [authed, password]
  );

  return { password, status, authed, error, pending, headers, jsonHeaders, login, logout };
}
