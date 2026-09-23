import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ success: true });
}
