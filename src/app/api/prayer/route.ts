import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("prayer_requests")
    .select("id, name, request, pray_count, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { name, request } = await req.json();
  if (!request?.trim()) return NextResponse.json({ error: "Request is required" }, { status: 400 });

  const { error } = await supabase.from("prayer_requests").insert({
    name: name?.trim() || "مجهول",
    request: request.trim(),
    status: "pending",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
