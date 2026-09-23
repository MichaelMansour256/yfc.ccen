/**
 * Auth gate + API client for every /admin/attendance/* screen.
 *
 * The layout wraps its children in this provider, so:
 *   • the admin password is read once and shared through context
 *   • pages never mount before authentication is resolved (no 401 on first paint)
 *   • every request goes through `request()`, which attaches the existing
 *     x-admin-password header, normalises errors into Arabic messages and maps
 *     the "tables missing" case onto `missingSchema` for a clear setup notice
 */
"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAdminAuth, type AdminAuth } from "@/hooks/useAdminAuth";
import { Banner, Spinner, cardClass, inputClass, primaryBtn } from "./ui";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  /** The Supabase migration has not been applied yet (HTTP 503). */
  missingSchema?: boolean;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  json?: unknown;
  signal?: AbortSignal;
}

export interface AttendanceApi extends AdminAuth {
  request: <T>(path: string, options?: RequestOptions) => Promise<ApiResult<T>>;
}

const AttendanceContext = createContext<AttendanceApi | null>(null);

/** Access the shared admin session + API client. */
export function useAttendanceApi(): AttendanceApi {
  const ctx = useContext(AttendanceContext);
  if (!ctx) {
    throw new Error("useAttendanceApi() must be used inside <AdminAuthProvider>");
  }
  return ctx;
}

export default function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const request = useCallback(
    async <T,>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> => {
      const hasJson = options.json !== undefined;
      try {
        const res = await fetch(path, {
          method: options.method ?? (hasJson ? "POST" : "GET"),
          headers: hasJson ? auth.jsonHeaders : auth.headers,
          body: hasJson ? JSON.stringify(options.json) : undefined,
          signal: options.signal,
          cache: "no-store",
        });

        let payload: any = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }

        if (res.status === 401) {
          auth.logout();
          return {
            ok: false,
            status: 401,
            data: null,
            error: "انتهت صلاحية الدخول، سجّل الدخول من جديد.",
          };
        }

        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            data: null,
            error: payload?.error ?? "فشل تنفيذ الطلب",
            missingSchema: payload?.code === "missing_schema",
          };
        }

        return { ok: true, status: res.status, data: payload as T };
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          return { ok: false, status: 0, data: null };
        }
        return {
          ok: false,
          status: 0,
          data: null,
          error: "تعذّر الاتصال بالخادم. تحقّق من الشبكة وحاول مرة أخرى.",
        };
      }
    },
    [auth]
  );

  const value = useMemo<AttendanceApi>(() => ({ ...auth, request }), [auth, request]);

  if (auth.status === "checking") {
    return (
      <div className="min-h-dvh page-gradient-high">
        <Spinner label="جارٍ التحقق من صلاحية الدخول…" />
      </div>
    );
  }

  if (!auth.authed) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 page-gradient-high">
        <div className={`w-full max-w-sm ${cardClass} p-8 backdrop-blur-sm`}>
          <h1 className="mb-2 text-center text-2xl font-bold text-white">🔐 Admin Login</h1>
          <p className="mb-6 text-center text-sm text-blue-light/60">
            دخول نظام الحضور بكلمة مرور الإدارة
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await auth.login(passwordInput);
            }}
            className="flex flex-col gap-4"
          >
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="كلمة المرور"
              autoComplete="current-password"
              className={inputClass}
            />
            {auth.error && <Banner tone="error">{auth.error}</Banner>}
            <button type="submit" disabled={auth.pending} className={primaryBtn}>
              {auth.pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>
  );
}
