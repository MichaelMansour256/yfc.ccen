/**
 * Attendance navigation.
 *
 * Fits the existing admin navigation style (the tab row in src/app/admin/page.tsx)
 * and stays usable on a phone: one horizontally scrollable row, emoji + label,
 * current tab highlighted with the theme accent.
 */
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cardClass } from "./ui";

export interface AttendanceTab {
  key: string;
  label: string;
  icon: string;
  href: string;
}

export const attendanceTabs: AttendanceTab[] = [
  { key: "dashboard", label: "لوحة الحضور", icon: "📊", href: "/admin/attendance/dashboard" },
  { key: "scan", label: "مسح QR", icon: "📷", href: "/admin/attendance/scan" },
  { key: "members", label: "الأعضاء", icon: "👥", href: "/admin/attendance/members" },
  { key: "meetings", label: "الاجتماعات", icon: "📅", href: "/admin/attendance/meetings" },
  { key: "reports", label: "التقارير", icon: "📈", href: "/admin/attendance/reports" },
];

/** True when `pathname` is the tab itself or one of its sub-pages. */
export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AttendanceNav({ current }: { current?: string }) {
  const pathname = usePathname();
  const activeKey =
    current ?? attendanceTabs.find((t) => isTabActive(pathname, t.href))?.key ?? "dashboard";

  return (
    <nav
      className={`${cardClass} mb-5 flex gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      aria-label="أقسام الحضور"
    >
      {attendanceTabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-blue-accent text-white"
                : "text-blue-light/70 hover:bg-blue-primary/60 hover:text-white"
            }`}
          >
            <span aria-hidden>{tab.icon}</span>
            <span className="whitespace-nowrap">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
