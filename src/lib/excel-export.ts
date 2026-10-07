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
  wb.creator = "yfc.ccen attendance";
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

/**
 * Build the downloadable import template (GET /api/attendance/members/import).
 *
 * Sheet 1 "Members": the three spec columns — Name | Phone | Date of Birth —
 * with "(optional)" spelled out in the headers (both English and Arabic) and
 * three example rows showing every combination, including an empty phone and an
 * empty date of birth. Column detection accepts these bilingual headers (and
 * many more variations) — see normalizeHeader() in src/lib/excel-import.ts.
 *
 * Sheet 2 "تعليمات": Arabic instructions (RTL) explaining the workflow,
 * accepted header spellings and the duplicate-skip behaviour.
 */
export async function generateMembersTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "yfc.ccen attendance";
  wb.created = new Date();

  const ws = wb.addWorksheet("Members", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "Name / الاسم", key: "name", width: 30 },
    { header: "Phone (optional) / رقم التليفون (اختياري)", key: "phone", width: 34 },
    { header: "Date of Birth (optional) / تاريخ الميلاد (اختياري)", key: "dob", width: 34 },
  ];

  ws.getRow(1).height = 22;
  ws.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  // Example rows: Date.UTC so the written serial round-trips to the same day
  // regardless of the server's time zone.
  const examples = [
    { name: "مينا عادل", phone: "01001234567", dob: new Date(Date.UTC(1995, 2, 12)) },
    { name: "مريم فؤاد", phone: null, dob: null }, // name only — both columns optional
    { name: "John Mark", phone: "01234567890", dob: new Date(Date.UTC(2001, 6, 22)) },
  ];
  examples.forEach((example, index) => {
    const row = ws.addRow(example);
    row.eachCell((cell) => {
      cell.font = BODY_FONT;
      if (index % 2 === 1) cell.fill = STRIPE_FILL;
    });
    row.getCell("dob").numFmt = "yyyy-mm-dd";
    row.getCell("phone").alignment = { horizontal: "center", vertical: "middle" };
    row.getCell("dob").alignment = { horizontal: "center", vertical: "middle" };
  });

  const guide = wb.addWorksheet("تعليمات", { views: [{ rightToLeft: true }] });
  guide.getColumn(1).width = 100;
  const lines: Array<[string, boolean]> = [
    ["استيراد أعضاء من Excel", true],
    ["", false],
    ["• العمود المطلوب الوحيد هو الاسم (Name) — الصفوف بلا اسم تُرفض ويظهر رقمها في شاشة الأخطاء.", false],
    ["• رقم التليفون (Phone) اختياري — يمكن تركه فارغًا بالكامل.", false],
    ["• تاريخ الميلاد (Date of Birth) اختياري — يمكن تركه فارغًا بالكامل.", false],
    ["• يقبل النظام أسماء الأعمدة بالإنجليزية أو العربية بأي أحرف:", false],
    ["    Name / name / الاسم", false],
    ["    Phone / phone / رقم التليفون / رقم الهاتف", false],
    ["    Date of Birth / birth_date / date_of_birth / تاريخ الميلاد", false],
    ["• صيغ التاريخ المقبولة: YYYY-MM-DD أو يوم/شهر/سنة (مثال 12/03/1995).", false],
    ["• قبل الاستيراد تظهر معاينة كاملة: عدد الصفوف والأخطاء والأعضاء المكررين.", false],
    ["• الأعضاء الموجودون بالفعل لن يتم تعديلهم — يتم تخطيهم فقط (لا تكرار عند إعادة رفع نفس الملف).", false],
    ["• كل عضو جديد يُنشأ برمز QR جديد مباشرة ويظهر في نظام الحضور فورًا.", false],
  ];
  lines.forEach(([text, bold]) => {
    const row = guide.addRow([text]);
    row.getCell(1).font = { name: "Cairo", size: 11, bold: bold || undefined };
    row.getCell(1).alignment = { wrapText: true, vertical: "top" };
  });

  return wb;
}
