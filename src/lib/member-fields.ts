/**
 * Member field sanitisation, normalisation and duplicate matching.
 *
 * SERVER- and CLIENT-safe: this module has NO runtime imports (no Supabase, no
 * Node built-ins), so API routes, the Excel importer and the offline test
 * script (scripts/verify-member-import.mjs) all share the exact same rules.
 *
 * Two invariants of the feature live here:
 *   1. phone number and date of birth are OPTIONAL everywhere — "", null and
 *      undefined all mean "not provided" → stored as NULL, never an error.
 *   2. re-importing the same Excel file must not create duplicates — rows are
 *      matched against existing members (member code → name+phone → name) and
 *      against earlier rows of the same file before anything is inserted.
 */

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ══════════════════════════════════════════════════════════════════════════ */

/** Result of sanitising an optional field: value (null = not provided) or an Arabic error. */
export type FieldResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** What the duplicate check decided for one Excel row. */
export type ImportRowStatus =
  | "new"
  | "existing"
  | "possible_duplicate"
  | "duplicate_in_file";

/** The subset of an existing member the matching logic needs. */
export interface MatchableMember {
  name: string;
  member_code?: string | null;
  phone?: string | null;
}

/** One parsed (and field-validated) row waiting for duplicate classification. */
export interface MatchableRow {
  /** Excel row number (1-based, includes the header row) — used in error messages. */
  row: number;
  name: string;
  phone?: string | null;
  date_of_birth?: string | null;
  member_code?: string | null;
}

export interface ClassifiedRow<T extends MatchableRow> {
  row: T;
  status: ImportRowStatus;
  /** Arabic explanation shown for skipped rows (null for brand-new rows). */
  reason: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * TEXT HELPERS
 * ══════════════════════════════════════════════════════════════════════════ */

const AR_INDIC = "٠١٢٣٤٥٦٧٨٩"; // ٠-٩
const AR_INDIC_EXT = "۰۱۲۳۴۵۶۷۸۹"; // ۰-۹

/** "٠١٢" → "012" — Arabic-Indic digits typed on an Arabic keyboard → ASCII. */
export function toAsciiDigits(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const a = AR_INDIC.indexOf(ch);
    if (a > -1) {
      out += String(a);
      continue;
    }
    const b = AR_INDIC_EXT.indexOf(ch);
    out += b > -1 ? String(b) : ch;
  }
  return out;
}

/** Values people leave in "empty" spreadsheet cells instead of clearing them. */
const PLACEHOLDERS = new Set(["-", "–", "—", "n/a", "na", "none", "null", "لا يوجد", "بدون"]);

function asTrimmedString(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Date) return raw.toISOString();
  return String(raw);
}

function isEmptyPlaceholder(value: string): boolean {
  return value === "" || PLACEHOLDERS.has(value.toLowerCase());
}

/**
 * Trim + collapse whitespace + strip control characters.
 * Returns "" when the name is missing — the caller decides that empty = invalid
 * (name is the only required field in the whole feature).
 */
export function sanitizeName(raw: unknown): string {
  return asTrimmedString(raw)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ══════════════════════════════════════════════════════════════════════════
 * PHONE (optional)
 * ══════════════════════════════════════════════════════════════════════════ */

const PHONE_OK = /^\+?\d{7,15}$/; // E.164-ish: 7–15 digits, optional leading +

/**
 * Normalise an optional phone number.
 *
 *   • empty / placeholder cells                    → ok, null (never an error)
 *   • "٠١٠…" Arabic-Indic digits                    → ASCII
 *   • "(0100) 123-4567", "0100 123 4567"            → "01001234567"
 *   • "+20 100 123 4567", "00201001234567"          → "01001234567" (local form)
 *   • numeric Excel cells that lost their leading 0 → "01001234567"
 *   • anything else                                 → ok: false (Arabic message)
 */
export function sanitizePhone(raw: unknown): FieldResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };

  let s: string;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0 || !Number.isInteger(raw)) {
      return { ok: false, error: "رقم التليفون غير صالح" };
    }
    s = String(raw);
    // Excel drops a leading "0" when 01001234567 is stored as a number.
    if (/^[1-9]\d{9}$/.test(s)) s = `0${s}`;
  } else {
    s = toAsciiDigits(asTrimmedString(raw));
  }

  if (isEmptyPlaceholder(s)) return { ok: true, value: null };

  s = s.replace(/[\s\-().\u00A0]/g, "");
  if (s === "") return { ok: true, value: null };

  if (s.startsWith("00")) s = s.slice(2); // 0020… → 20…
  if (/^201\d{8}$/.test(s)) s = `0${s.slice(2)}`; // +20 100… → 0100…

  if (!PHONE_OK.test(s)) return { ok: false, error: "رقم التليفون غير صالح" };
  return { ok: true, value: s };
}

/* ══════════════════════════════════════════════════════════════════════════
 * DATE OF BIRTH (optional)
 * ══════════════════════════════════════════════════════════════════════════ */

const BAD_DATE = "صيغة تاريخ الميلاد غير صالحة — استخدم يوم/شهر/سنة أو YYYY-MM-DD";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build "YYYY-MM-DD" after verifying y/m/d is a real calendar date. */
function isoFromParts(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null; // e.g. 31/02
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Excel serial number → ISO date (1900 date system; 25569 = 1970-01-01 — the
 * same epoch exceljs and SheetJS use). Fractional (datetime) serials take the
 * date part. Returns null when the serial is outside any plausible lifetime.
 */
function isoFromSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  const dt = new Date(Math.round((serial - 25569) * 86400000));
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function rangeCheck(iso: string): FieldResult {
  const today = new Date();
  const todayIso = `${today.getUTCFullYear()}-${pad2(today.getUTCMonth() + 1)}-${pad2(today.getUTCDate())}`;
  if (iso > todayIso) return { ok: false, error: "تاريخ الميلاد لا يمكن أن يكون في المستقبل" };
  return { ok: true, value: iso };
}

/**
 * Normalise an optional date of birth to Postgres `date` format ("YYYY-MM-DD").
 *
 * Accepts, in order:
 *   • null / undefined / empty / placeholder cells  → ok, null (never an error)
 *   • Date objects (date-formatted Excel cells)     → UTC date part
 *   • numbers: Excel serials (34805) or YYYYMMDD    → ISO
 *   • "2005-03-12", "2005/3/12", "2005-3-12 0:00"   → ISO
 *   • "12/03/2005", "12-3-2005", "12.03.2005"       → ISO (DAY-first, documented)
 *
 * The result must be between 1900-01-01 and today, otherwise ok: false.
 */
export function sanitizeDateOfBirth(raw: unknown): FieldResult {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return { ok: false, error: BAD_DATE };
    const iso = isoFromParts(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
    if (!iso) return { ok: false, error: BAD_DATE };
    return rangeCheck(iso);
  }

  if (typeof raw === "number") {
    const iso =
      Number.isInteger(raw) && raw >= 19000101 && raw <= 21001231
        ? isoFromParts(Math.floor(raw / 10000), Math.floor(raw / 100) % 100, raw % 100)
        : isoFromSerial(raw);
    if (!iso) return { ok: false, error: BAD_DATE };
    return rangeCheck(iso);
  }

  const s = toAsciiDigits(asTrimmedString(raw));
  if (isEmptyPlaceholder(s)) return { ok: true, value: null };

  // ISO-ish first: 2005-03-12 / 2005/3/12 / 2005-3-12 [time part ignored]
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) {
    const iso = isoFromParts(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
    if (!iso) return { ok: false, error: BAD_DATE };
    return rangeCheck(iso);
  }

  // Day-first: 12/03/2005 / 12-3-2005 / 12.03.2005 (Arabic/European convention)
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) {
    const iso = isoFromParts(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10));
    if (!iso) return { ok: false, error: BAD_DATE };
    return rangeCheck(iso);
  }

  return { ok: false, error: BAD_DATE };
}

/* ══════════════════════════════════════════════════════════════════════════
 * MATCH KEYS — used for duplicate detection (case/diacritic-insensitive)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Fold a member name to its comparison form:
 *   "مِينا عَادِل" / "مينا عادل" / "Mina Adel " → same key.
 * Arabic: strips tashkeel & tatweel, folds alef/hamza/ya/ta-marbuta variants.
 * Latin: lowercased, punctuation removed, whitespace collapsed.
 */
export function nameMatchKey(name: string): string {
  return sanitizeName(name)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "") // tashkeel + tatweel
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ ٱ → ا
    .replace(/\u0649/g, "\u064A") // ى → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/[^\p{L}\p{N}]/gu, " ") // punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}

/** Digits-only key for a phone number (input must already be sanitized). */
export function phoneMatchKey(phone: string | null | undefined): string {
  if (!phone) return "";
  return toAsciiDigits(phone).replace(/\D/g, "");
}

/** Lower-cased key for member codes so "m001" matches "M001". */
export function memberCodeMatchKey(code: string | null | undefined): string {
  if (!code) return "";
  return code.trim().toLowerCase().replace(/\s+/g, "");
}

/* ══════════════════════════════════════════════════════════════════════════
 * DUPLICATE CLASSIFICATION (pure — no database access)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Decide, for every valid row, whether importing it would duplicate something.
 *
 * Match priority (per the feature spec, against BOTH existing members and
 * earlier rows of the same file):
 *   1. member code            → "existing"          (strongest identifier)
 *   2. name + phone           → "existing"          (strongest when no code)
 *   3. normalized name only   → "possible_duplicate"
 *   4. matching an earlier row of THIS file        → skipped as in-file duplicate
 *
 * SAFEST-BEHAVIOUR CHOICE: every non-"new" row is SKIPPED, never updated.
 * Nothing is overwritten, and re-uploading the same file is idempotent — every
 * row resolves to the same status on every upload (rows created by run #1 are
 * matched by run #2). A genuinely different person who happens to share a name
 * with an existing member is reported as a possible duplicate so a servant can
 * add them manually (the single-member form), instead of silently creating
 * duplicate rows on every import.
 *
 * The classification is order-dependent: rows marked "new" join the "already
 * seen" index so later rows of the same file are caught too.
 */
export function classifyImportRows<T extends MatchableRow>(
  rows: T[],
  existing: MatchableMember[]
): ClassifiedRow<T>[] {
  const byCode = new Set<string>();
  const byNamePhone = new Set<string>();
  const byName = new Set<string>();
  for (const m of existing) {
    const code = memberCodeMatchKey(m.member_code);
    if (code) byCode.add(code);
    const nk = nameMatchKey(m.name);
    if (nk) {
      byName.add(nk);
      const pk = phoneMatchKey(m.phone);
      if (pk) byNamePhone.add(`${nk}|${pk}`);
    }
  }

  const publish = (row: T) => {
    const nk = nameMatchKey(row.name);
    const pk = phoneMatchKey(row.phone);
    const code = memberCodeMatchKey(row.member_code);
    if (code) byCode.add(code);
    if (nk) {
      byName.add(nk);
      if (pk) byNamePhone.add(`${nk}|${pk}`);
    }
  };

  return rows.map((row) => {
    const nk = nameMatchKey(row.name);
    const pk = phoneMatchKey(row.phone);
    const code = memberCodeMatchKey(row.member_code);

    // 1) member code — the Excel file supplies an existing id.
    if (code && byCode.has(code)) {
      return { row, status: "existing" as const, reason: "موجود بالفعل — طابق كود العضو" };
    }

    // 2) name + phone — exact identity when no code was given.
    if (pk && byNamePhone.has(`${nk}|${pk}`)) {
      return {
        row,
        status: "existing" as const,
        reason: "موجود بالفعل — طابق الاسم ورقم التليفون",
      };
    }

    // 3) name only — cannot prove identity either way → possible duplicate.
    if (nk && byName.has(nk)) {
      return {
        row,
        status: "possible_duplicate" as const,
        reason: "يوجد عضو بنفس الاسم — تم التخطي للمراجعة اليدوية",
      };
    }

    publish(row);
    return { row, status: "new" as const, reason: null };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * MEMBER CODE ALLOCATION (bulk create)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Sequential member codes for a batch (M001, M002, …) that never collide with
 * existing codes or with caller-reserved ones (codes coming from the Excel
 * file). Mirrors nextMemberCode()'s prefix/width rules: prefix and zero-pad
 * width come from the numerically largest existing code, minimum width 3.
 */
export function allocateMemberCodes(
  existingCodes: string[],
  needed: number,
  reserved: Iterable<string> = []
): string[] {
  const taken = new Set<string>();
  for (const c of existingCodes) {
    const k = memberCodeMatchKey(c);
    if (k) taken.add(k);
  }
  for (const c of reserved) {
    const k = memberCodeMatchKey(c);
    if (k) taken.add(k);
  }

  let maxNum = 0;
  let prefix = "M";
  let width = 3;
  for (const code of existingCodes) {
    const trimmed = code.trim();
    if (!trimmed) continue;
    const num = parseInt(trimmed.replace(/\D+/g, ""), 10);
    if (Number.isNaN(num)) continue;
    if (num > maxNum) {
      maxNum = num;
      prefix = trimmed.replace(/\d+$/, "") || "M";
      width = Math.max(3, String(num).length);
    }
  }

  const out: string[] = [];
  let n = maxNum + 1;
  while (out.length < needed) {
    const candidate = `${prefix}${String(n).padStart(width, "0")}`;
    n += 1;
    const key = memberCodeMatchKey(candidate);
    if (taken.has(key)) continue;
    out.push(candidate);
    taken.add(key);
  }
  return out;
}



