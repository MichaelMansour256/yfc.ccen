/**
 * Layout for /admin/attendance/*.
 *
 * The whole section is client-side on purpose: attendance data is only reachable
 * through the authenticated APIs (x-admin-password) and no Supabase key is ever
 * shipped to the browser. AdminAuthProvider resolves the session, gates the
 * children and provides the shared API client; AttendanceShell adds the header
 * and navigation. The parent /admin/layout.tsx still supplies <html>, <body> and
 * the live theme variables.
 */
"use client";
import AdminAuthProvider from "@/components/attendance/AdminAuthProvider";
import AttendanceShell from "@/components/attendance/AttendanceShell";

export default function AttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AttendanceShell>{children}</AttendanceShell>
    </AdminAuthProvider>
  );
}
