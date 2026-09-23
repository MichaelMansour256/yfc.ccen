import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Fetch current count first
  const { data, error: fetchError } = await supabase
    .from("prayer_requests")
    .select("pray_count")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (fetchError || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("prayer_requests")
    .update({ pray_count: data.pray_count + 1 })
    .eq("id", id)
    .eq("status", "approved");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pray_count: data.pray_count + 1 });
}
