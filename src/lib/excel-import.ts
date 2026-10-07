/**
 * Excel import — parse .xlsx / .xls member files with SheetJS.
 *
 * SERVER-ONLY (imported by /api/attendance/members/import). SheetJS was added
 * for this feature because the existing `exceljs` dependency cannot read the
 * legacy .xls (BIFF) format the spec requires; exceljs keeps doing what it
 * already did (attendance exports + the downloadable import template).
 *
 * Pipeline:  bytes → sheet grid → header row → column detection (Arabic AND
 * English headers, any capitalisation) → per-row validation →
 * { valid rows, invalid rows with their Excel row numbers }.
 *
 * Validation rules (shared with the rest of the app via member-fields.ts):
 *   • Name is the ONLY required field — an empty phone/DOb cell is valid.
 *   • phone / date_of_birth, when present, must sanitise cleanly.
 *   • rows are reported with their real spreadsheet row number (header = row 1)
 *     so an error can say exactly "الصف 8: الاسم مفقود".
 */
import * as XLSX from "xlsx";
import {
  sanitizeDateOfBirth,
  sanitizeName,
  sanitizePhone,
} from "./member-fields";
import type { ImportRowStatus, MatchableRow } from "./member-fields";

/** Hard limits — the API accepts the file as base64 JSON (Vercel caps bodies at 4.5 MB). */
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Recognised header names, AFTER normalisation (see normalizeHeader). */
const NAME_KEYS = ["name", "الاسم", "اسم"];
const PHONE_EXACT = new Set([
  "phone", "phone_number", "phoneno", "mobile", "tel", "telephone", "contact",
  "رقم_التليفون", "رقم_الهاتف", "التليفون", "الهاتف", "تليفون", "هاتف",
  "رقم_الموبايل", "موبايل", "جوال", "الموبايل",
]);
const DOB_EXACT = new Set([
  "date_of_birth", "dob", "birth_date", "birthday", "birthdate",
  "تاريخ_الميلاد", "تاريخ_ميلاد", "الميلاد", "المواليد", "تاريخ",
]);
const DOB_KEYS = ["birth", "dob", "ميلاد", "مواليد"];
const CODE_EXACT = new Set([
  "member_code", "code", "membercode", "member_id", "id",
  "كود", "كود_العضو", "رقم_العضو", "رقم_العضوية",
]);

export type ImportField = "name" | "phone" | "date_of_birth" | "member_code";

/** Original header text per detected column (null = not present in the file). */
export interface DetectedColumns {
  name: string | null;
  phone: string | null;
  date_of_birth: string | null;
  member_code: string | null;
}

/** One row that passed validation. */
export interface ParsedMemberRow extends MatchableRow {
  name: string;
  phone: string | null;
  date_of_birth: string | null;
  member_code: string | null;
}

export interface InvalidRow {
  /** Real Excel row number (the header row counts). */
  row: number;
  /** What the row's name cell contained (null when empty) — helps locating it. */
  name: string | null;
  reason: string;
}

export interface ParsedWorkbook {
  fileName: string;
  sheetName: string;
  /** Excel row number of the detected header row (almost always 1). */
  headerRow: number;
  columns: DetectedColumns;
  /** Non-empty data rows found (valid + invalid). */
  totalDataRows: number;
  valid: ParsedMemberRow[];
  invalid: InvalidRow[];
}

/** Parse/validation failure with a user-facing Arabic message (HTTP 400). */
export class ImportError extends Error {
  readonly detectedColumns: DetectedColumns | null;
  constructor(message: string, detectedColumns: DetectedColumns | null = null) {
    super(message);
    this.name = "ImportError";
    this.detectedColumns = detectedColumns;
  }
}

/**
 * Fold any header spelling to a comparable key:
 *   "Date of Birth" → "date_of_birth"   •  "تاريخ الميلاد" → "تاريخ_الميلاد"
 *   "  FULL  NAME " → "full_name"       •  Arabic-Indic digits → ASCII
 */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // tashkeel + tatweel
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ ٱ → ا
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/[^\p{L}\p{N}]+/gu, "_") // spaces/punctuation → "_"
    .replace(/^_+|_+$/g, "");
}

const NAME_EXACT = new Set([
  "name", "full_name", "fullname", "member_name", "student_name",
  "الاسم", "اسم", "الاسم_الكامل", "اسم_العضو", "اسم_الطالب",
]);
const PHONE_KEYS = ["phone", "tel", "contact", "تليفون", "تليفونات", "هاتف", "موبايل", "جوال"];
const CODE_HAS = ["member_code", "_code", "كود", "العضوية"];

function classifyHeader(header: string): ImportField | null {
  const h = normalizeHeader(header);
  if (!h) return null;
  // Exact/strong matches win first so "اسم التليفون" is a phone column, etc.
  if (PHONE_EXACT.has(h)) return "phone";
  if (DOB_EXACT.has(h)) return "date_of_birth";
  if (CODE_EXACT.has(h)) return "member_code";
  if (NAME_EXACT.has(h)) return "name";
  if (PHONE_KEYS.some((k) => h.includes(k))) return "phone";
  if (DOB_KEYS.some((k) => h.includes(k))) return "date_of_birth";
  if (CODE_HAS.some((k) => h.includes(k))) return "member_code";
  return null;
}

/** Last-resort name detection ("اسم الاب" etc.) — only for still-unfilled slots. */
function isNameishHeader(header: string): boolean {
  const h = normalizeHeader(header);
  if (!h) return false;
  return NAME_KEYS.some((k) => h.includes(k));
}

function headerText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return "";
  return String(cell).trim();
}

function rowIsEmpty(cells: unknown[]): boolean {
  return cells.every((c) => headerText(c) === "");
}

/**
 * Parse one uploaded workbook into validated rows.
 * Throws ImportError (Arabic, user-facing) for unreadable/empty files or when
 * no Name column can be found.
 */
export function parseMembersWorkbook(fileName: string, data: Uint8Array): ParsedWorkbook {
  if (data.byteLength === 0) throw new ImportError("الملف فارغ");
  if (data.byteLength > IMPORT_MAX_FILE_BYTES) {
    throw new ImportError("حجم الملف يتجاوز الحد الأقصى (2MB)");
  }

  let wb: XLSX.WorkBook;
  try {
    // SheetJS auto-detects the container: .xlsx (zip) AND legacy .xls (BIFF).
    wb = XLSX.read(data, { type: "array", cellDates: true });
  } catch {
    throw new ImportError("تعذّر قراءة الملف — تأكد أنه ملف Excel (.xlsx أو .xls) صالح");
  }

  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws || !ws["!ref"]) throw new ImportError("الملف لا يحتوي على أي بيانات");

  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    blankrows: true,
    defval: null,
  });
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const sheetRowOf = (i: number) => range.s.r + i + 1; // 1-based spreadsheet row

  const headerIndex = grid.findIndex((cells) => cells && !rowIsEmpty(cells));
  if (headerIndex === -1) throw new ImportError("الملف لا يحتوي على أي بيانات");

  const headers = (grid[headerIndex] ?? []).map(headerText);

  // Column detection: pass 1 exact/strong matches for every field incl. name,
  // pass 2 loose name matching for headers nobody claimed yet.
  const idx: Record<ImportField, number | null> = {
    name: null,
    phone: null,
    date_of_birth: null,
    member_code: null,
  };
  const claimed = new Set<number>();
  headers.forEach((header, i) => {
    const field = classifyHeader(header);
    if (field && idx[field] === null && !claimed.has(i)) {
      idx[field] = i;
      claimed.add(i);
    }
  });
  if (idx.name === null) {
    headers.forEach((header, i) => {
      if (idx.name === null && !claimed.has(i) && isNameishHeader(header)) {
        idx.name = i;
        claimed.add(i);
      }
    });
  }

  const detected: DetectedColumns = {
    name: idx.name !== null ? headers[idx.name] || null : null,
    phone: idx.phone !== null ? headers[idx.phone] || null : null,
    date_of_birth: idx.date_of_birth !== null ? headers[idx.date_of_birth] || null : null,
    member_code: idx.member_code !== null ? headers[idx.member_code] || null : null,
  };

  if (idx.name === null) {
    throw new ImportError(
      `لم يتم العثور على عمود الاسم في الملف. الأعمدة المكتشفة: ${
        headers.filter(Boolean).join("، ") || "لا شيء"
      }`,
      detected
    );
  }

  const valid: ParsedMemberRow[] = [];
  const invalid: InvalidRow[] = [];
  let totalDataRows = 0;

  for (let i = headerIndex + 1; i < grid.length; i += 1) {
    const cells = grid[i] ?? [];
    if (rowIsEmpty(cells)) continue; // blank spreadsheet rows are not data
    totalDataRows += 1;
    if (totalDataRows > IMPORT_MAX_ROWS) {
      throw new ImportError(`الملف يتجاوز الحد الأقصى (${IMPORT_MAX_ROWS} صف)`);
    }

    const at = (column: number | null): unknown =>
      column !== null && column < cells.length ? cells[column] : null;
    const excelRow = sheetRowOf(i);

    const name = sanitizeName(at(idx.name));
    if (!name) {
      invalid.push({ row: excelRow, name: null, reason: "الاسم مفقود" });
      continue;
    }
    if (name.length > 120) {
      invalid.push({ row: excelRow, name, reason: "الاسم طويل جدًا (الأقصى 120 حرفًا)" });
      continue;
    }

    const phone = sanitizePhone(at(idx.phone));
    if (!phone.ok) {
      invalid.push({ row: excelRow, name, reason: phone.error });
      continue;
    }

    const dob = sanitizeDateOfBirth(at(idx.date_of_birth));
    if (!dob.ok) {
      invalid.push({ row: excelRow, name, reason: dob.error });
      continue;
    }

    const codeValue = sanitizeName(at(idx.member_code));
    if (codeValue.length > 32) {
      invalid.push({ row: excelRow, name, reason: "كود العضو طويل جدًا (الأقصى 32 حرفًا)" });
      continue;
    }

    valid.push({
      row: excelRow,
      name,
      phone: phone.value,
      date_of_birth: dob.value,
      member_code: codeValue || null,
    });
  }

  if (totalDataRows === 0) {
    throw new ImportError("الملف لا يحتوي على أي صفوف بيانات");
  }

  return {
    fileName,
    sheetName,
    headerRow: sheetRowOf(headerIndex),
    columns: detected,
    totalDataRows,
    valid,
    invalid,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * API PAYLOAD TYPES — shared with the import UI (import type only)
 * ══════════════════════════════════════════════════════════════════════════ */

export interface ImportPreviewRow extends ParsedMemberRow {
  status: ImportRowStatus;
  reason: string | null;
}

/** POST /api/attendance/members/import  { action: "preview" } → response body. */
export interface ImportPreview {
  fileName: string;
  sheetName: string;
  headerRow: number;
  /** Non-empty data rows in the file (valid + invalid). */
  totalRows: number;
  validRows: number;
  invalidRows: number;
  columns: DetectedColumns;
  counts: {
    new: number;
    existing: number;
    possible_duplicate: number;
    duplicate_in_file: number;
    invalid: number;
  };
  /** First rows of the sheet, with their resolution — the "معاينة البيانات" table. */
  preview: ImportPreviewRow[];
  /** Every invalid row with its Excel row number and reason. */
  invalid: InvalidRow[];
  /** Human-readable Arabic warnings (possible duplicates, missing columns, …). */
  warnings: string[];
}

export interface ImportSkippedRow {
  row: number;
  name: string;
  status: ImportRowStatus;
  reason: string;
}

/** POST /api/attendance/members/import  { action: "confirm" } → response body. */
export interface ImportResult {
  fileName: string;
  /** Rows processed: valid + invalid (blank spreadsheet rows excluded). */
  total: number;
  /** Members actually created (one atomic bulk INSERT). */
  imported: number;
  /** Skipped: matched an existing member (by code or name+phone). */
  skippedExisting: number;
  /** Skipped: name matched an existing member — possible duplicate. */
  skippedPossible: number;
  /** Skipped: repeated earlier inside the same file. */
  skippedDuplicates: number;
  /** skippedExisting + skippedPossible + skippedDuplicates */
  skipped: number;
  /** Invalid rows (missing name / bad phone / bad date). */
  failed: number;
  failures: InvalidRow[];
  skippedRows: ImportSkippedRow[];
}




