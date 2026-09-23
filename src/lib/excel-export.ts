/**
 * Excel export helpers — build .xlsx attendance reports.
 *
 * Uses `exceljs` (already a project dependency) server-side, so it works on
 * Vercel serverless functions and needs no paid service. The caller writes the
 * workbook with `writeBuffer()` — see /api/attendance/export.
 */
import ExcelJS from "exceljs";
import type { Meeting, MeetingMemberRow } from "./attendance";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1A3A8F" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: "Cairo",
  size: 11,
  bold: true,
  color: { argb: "FFFFFFFF" },
};
const BODY_FONT: Partial<ExcelJS.Font> = { name: "Cairo", size: 10 };
const PRESENT_FONT: Partial<ExcelJS.Font> = {
  name: "Cairo",
  size: 10,
  bold: true,
  color: { argb: "FF15803D" },
};
const ABSENT_FONT: Partial<ExcelJS.Font> = {
  name: "Cairo",
  size: 10,
  bold: true,
  color: { argb: "FFB91C1C" },
};
const STRIPE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F4FF" },
};

/** "2026-09-20" → local Date so Excel keeps a real date cell. */
function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** ISO timestamp → "11:32 PM" (Arabic locale, 12-hour clock). */
function toTimeLabel(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Build the attendance workbook for one meeting.
 *
 * Sheet 1 "Attendance": Member Name | Member Code | Meeting Date |
 *                       Meeting Title | Check-in Time | Status
 *   — one row per expected member, present AND absent.
 * Sheet 2 "Summary": meeting header + totals.
 */
export async function generateAttendanceWorkbook(
  meeting: Meeting,
  report: MeetingMemberRow[]
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "e3dady.ccen attendance";
  wb.created = new Date();

  const present = report.filter((r) => r.present).length;
  const total = report.length;
  const absent = total - present;
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;

  const ws = wb.addWorksheet("Attendance", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "Member Name", key: "name", width: 30 },
    { header: "Member Code", key: "code", width: 14 },
    { header: "Meeting Date", key: "date", width: 16 },
    { header: "Meeting Title", key: "title", width: 25 },
    { header: "Check-in Time", key: "checkin", width: 16 },
    { header: "Status", key: "status", width: 12 },
  ];

  ws.getRow(1).height = 20;
  ws.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  report.forEach((row, index) => {
    const timeLabel = toTimeLabel(row.check_in_time);
    const excelRow = ws.addRow({
      name: row.name,
      code: row.member_code,
      date: toDate(meeting.meeting_date),
      title: meeting.title,
      checkin: timeLabel ?? "—",
      status: row.present ? "Present" : "Absent",
    });

    excelRow.getCell("date").numFmt = "yyyy-mm-dd";
    excelRow.eachCell((cell) => {
      cell.font = BODY_FONT;
      if (index % 2 === 1) cell.fill = STRIPE_FILL;
    });

    excelRow.getCell("status").font = row.present ? PRESENT_FONT : ABSENT_FONT;
    excelRow.getCell("status").alignment = { horizontal: "center", vertical: "middle" };
    excelRow.getCell("checkin").alignment = { horizontal: "center", vertical: "middle" };
    excelRow.getCell("code").alignment = { horizontal: "center", vertical: "middle" };
    excelRow.getCell("date").alignment = { horizontal: "center", vertical: "middle" };
  });

  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { key: "label", width: 26 },
    { key: "value", width: 26 },
  ];
  const summaryRows: Array<[string, string | number]> = [
    ["Meeting", meeting.title],
    ["Meeting Date", meeting.meeting_date],
    ["Status", meeting.status],
    ["Total Members", total],
    ["Present", present],
    ["Absent", absent],
    ["Attendance Rate", `${rate}%`],
    ["Exported At", new Date().toISOString()],
  ];
  summaryRows.forEach(([label, value], index) => {
    const row = summary.addRow([label, value]);
    if (index === 0) row.font = { bold: true };
  });
  summary.getColumn(1).font = { bold: true };

  return wb;
}
