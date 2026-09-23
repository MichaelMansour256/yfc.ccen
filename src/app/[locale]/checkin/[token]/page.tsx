/**
 * /checkin/[token] — Public QR-code check-in page.
 *
 * Flow:
 *   1. Extract token from URL
 *   2. Find member by qr_token
 *   3. Verify member is active
 *   4. Find the current active meeting
 *   5. Record attendance (or detect duplicate)
 *   6. Render the appropriate result card
 *
 * This is a server component (RSC) — data fetching happens on the server, so
 * the page loads fast on mobile and works without client JS.
 */
import { checkIn, type CheckInResult } from "@/lib/attendance";

interface CheckinResult {
  type: "success" | "already_recorded" | "invalid_token" | "inactive_member" | "no_active_meeting" | "error";
  member?: { name: string; member_code: string };
  meeting?: { title: string; meeting_date: string; id?: string };
  check_in_time?: string | null;
  message?: string;
}

// ── Server-side check-in logic ──
async function performCheckin(token: string): Promise<CheckinResult> {
  if (!token || token.length < 8) {
    return { type: "invalid_token" };
  }

  const result = await checkIn(token);

  if (result.infrastructureError) {
    return { type: "error", message: "تعذّر الاتصال بنظام الحضور. حاول مرة أخرى." };
  }

  return {
    type: result.status,
    member: result.member ?? undefined,
    meeting: result.meeting ?? undefined,
    check_in_time: result.check_in_time ?? null,
  };
}

function formatDateAr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTimeAr(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ── Page ──
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await performCheckin(token);

  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f1f5c" />
        <title>تسجيل الحضور — {result.member?.name || ""}</title>
      </head>
      <body className="m-0 flex min-h-screen items-center justify-center bg-blue-dark">
        <div className="w-full max-w-sm rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-8 text-center backdrop-blur-sm">
          {renderResult(result, formatDateAr, formatTimeAr)}
        </div>
      </body>
    </html>
  );
}

// ── Result renderer ──
function renderResult(
  result: CheckinResult,
  fmtDate: (d: string) => string,
  fmtTime: (d: string) => string
) {
  const successCard = (result: CheckinResult, emoji: string, title: string) => (
    <>
      <div className="mb-6 text-5xl">{`${emoji} ${title}`}</div>
      <h2 className="mb-2 text-2xl font-bold text-white">{result.member?.name}</h2>
      <p className="mb-1 text-sm text-blue-light/60">{result.member?.member_code}</p>
      <div className="my-4 border-t border-blue-mid/20" />
      <h3 className="mb-1 text-lg font-semibold text-white">{result.meeting?.title}</h3>
      <p className="mb-2 text-sm text-blue-light/70">{fmtDate(result.meeting!.meeting_date)}</p>
      <p className="text-xs text-blue-light/50">
        وقت التسجيل: {fmtTime(result.check_in_time || new Date().toISOString())}
      </p>
    </>
  );

  switch (result.type) {
    case "success":
      return successCard(result, "✅", "تم تسجيل الحضور");
    case "already_recorded":
      return successCard(result, "ℹ️", "الحضور مسجل بالفعل");
    case "invalid_token":
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">❌ QR Code غير صالح</div>
          <p className="text-sm text-blue-light/60">
            الرمز المستخدم غير صالح أو غير مسجل.
          </p>
        </div>
      );
    case "inactive_member":
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">⚠️ هذا العضو غير نشط</div>
          <p className="text-sm text-blue-light/60">
            تواصل مع الإدارة إذا كنت تعتقد أنك تستقبل هذه الرسالة بالخطأ.
          </p>
        </div>
      );
    case "no_active_meeting":
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">ℹ️ لا يوجد اجتماع مفتوح حاليًا</div>
          <p className="text-sm text-blue-light/60">
            لا يوجد اجتماع جارٍ الآن. الرجاء المحاولة أثناء الاجتماع.
          </p>
        </div>
      );
    case "error":
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">❌ حدث خطأ</div>
          <p className="text-sm text-blue-light/60">{result.message || "خطأ غير معروف"}</p>
        </div>
      );
    default:
      return null;
  }
}
