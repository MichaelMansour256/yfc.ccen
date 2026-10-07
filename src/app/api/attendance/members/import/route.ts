/**
 * /api/attendance/members/import — Excel bulk import (preview → confirm).
 *
 *   GET    download the example template (.xlsx: Name | Phone | Date of Birth,
 *          bilingual headers + Arabic instructions sheet)
 *   POST   { action: "preview", fileName, file }  → parse + validate + classify
 *          { action: "confirm", fileName, file }  → same, then bulk-create
 *
 * The file travels base64-encoded in the JSON body (≤ 2MB — well under
 * Vercel's 4.5MB body cap). Both steps parse the uploaded bytes server-side;
 * "confirm" re-parses and re-validates from scratch, so nothing received from
 * the browser is ever trusted.
 *
 * Duplicate handling (see classifyImportRows in src/lib/member-fields.ts):
 * matched rows are SKIPPED, never updated — re-uploading the same file is a
 * no-op, and no existing member is ever overwritten.
 *
 * Auth: x-admin-password → the SAME requireAdmin that guards manual member
 * creation. Attendees/visitors (no password) can never reach this route.
 */
import { NextResponse } from "next/server";
import { importMembers, listMembers } from "@/lib/attendance";
import { badRequest, databaseError, readJson, requireAdmin } from "@/lib/attendance-api";
import { classifyImportRows } from "@/lib/member-fields";
import {
  ImportError,
  IMPORT_MAX_FILE_BYTES,
  parseMembersWorkbook,
  type ImportPreview,
  type ImportPreviewRow,
  type ImportResult,
  type ParsedWorkbook,
} from "@/lib/excel-import";
import { generateMembersTemplateWorkbook } from "@/lib/excel-export";

/** How many parsed rows the preview table shows. */
const PREVIEW_ROWS = 12;

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const workbook = await generateMembersTemplateWorkbook();
    const buffer = await workbook.xlsx.writeBuffer();

    // ASCII-only filename so every browser/Vercel edge accepts the header.
    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="members-import-template.xlsx"',
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return databaseError("members.import.template", err);
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await readJson<{ action?: unknown; fileName?: unknown; file?: unknown }>(req);
  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "preview" && action !== "confirm") {
    return badRequest('action must be "preview" or "confirm"');
  }

  const fileName =
    typeof body.fileName === "string" && body.fileName.trim()
      ? body.fileName.trim().slice(0, 120)
      : "members.xlsx";
  const base64 = typeof body.file === "string" ? body.file : "";
  if (!base64) return badRequest("file is required (base64-encoded .xlsx or .xls)");
  if (base64.length > (IMPORT_MAX_FILE_BYTES * 4) / 3 + 4096) {
    return badRequest("حجم الملف يتجاوز الحد الأقصى (2MB)");
  }

  let parsed: ParsedWorkbook;
  try {
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    parsed = parseMembersWorkbook(fileName, bytes);
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json(
        { error: err.message, code: "parse_error", columns: err.detectedColumns },
        { status: 400 }
      );
    }
    return databaseError("members.import.parse", err);
  }

  try {
    const existing = await listMembers();
    const classified = classifyImportRows(parsed.valid, existing);

    const counts = {
      new: 0,
      existing: 0,
      possible_duplicate: 0,
      duplicate_in_file: 0,
      invalid: parsed.invalid.length,
    };
    for (const row of classified) counts[row.status] += 1;

    if (action === "preview") {
      const preview: ImportPreviewRow[] = classified.slice(0, PREVIEW_ROWS).map((c) => ({
        ...c.row,
        status: c.status,
        reason: c.reason,
      }));

      const warnings: string[] = [];
      if (counts.existing > 0) {
        warnings.push(
          `${counts.existing} صف يطابق عضوًا موجودًا بالفعل — سيتم تخطيه (لا يتم تعديل أي بيانات موجودة).`
        );
      }
      if (counts.possible_duplicate > 0) {
        warnings.push(
          `${counts.possible_duplicate} صف بنفس الاسم لعضو موجود — تكرار محتمل، سيتم تخطيهم. أضفهم يدويًا لو كانوا أشخاصًا مختلفين.`
        );
      }
      if (counts.duplicate_in_file > 0) {
        warnings.push(`${counts.duplicate_in_file} صف مكرر داخل الملف نفسه — سيتم تخطيهم.`);
      }
      if (counts.invalid > 0) {
        warnings.push(`${counts.invalid} صف به أخطاء ولن يتم استيراده.`);
      }

      const payload: ImportPreview = {
        fileName: parsed.fileName,
        sheetName: parsed.sheetName,
        headerRow: parsed.headerRow,
        totalRows: parsed.totalDataRows,
        validRows: parsed.valid.length,
        invalidRows: parsed.invalid.length,
        columns: parsed.columns,
        counts,
        preview,
        invalid: parsed.invalid,
        warnings,
      };
      return NextResponse.json(payload);
    }

    // ── confirm: re-validated above from the uploaded bytes, then ONE insert ──
    const toCreate = classified.filter((c) => c.status === "new");
    const skippedRows = classified
      .filter((c) => c.status !== "new")
      .map((c) => ({
        row: c.row.row,
        name: c.row.name,
        status: c.status,
        reason: c.reason ?? "",
      }));

    const imported = await importMembers(
      toCreate.map((c) => ({
        name: c.row.name,
        phone: c.row.phone ?? null,
        date_of_birth: c.row.date_of_birth ?? null,
        member_code: c.row.member_code,
      }))
    );

    const result: ImportResult = {
      fileName: parsed.fileName,
      total: parsed.totalDataRows,
      imported,
      skippedExisting: counts.existing,
      skippedPossible: counts.possible_duplicate,
      skippedDuplicates: counts.duplicate_in_file,
      skipped: counts.existing + counts.possible_duplicate + counts.duplicate_in_file,
      failed: counts.invalid,
      failures: parsed.invalid,
      skippedRows,
    };
    return NextResponse.json(result);
  } catch (err) {
    return databaseError(`members.import.${action}`, err);
  }
}

