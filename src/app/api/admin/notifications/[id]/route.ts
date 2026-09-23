import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getNotificationById } from "@/lib/notifications-history";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(_req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const record = await getNotificationById(id);

  if (!record) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  }

  return NextResponse.json({
    notification: record,
  });
}
