import { NextResponse } from "next/server";
import { getEvents } from "@/lib/events";

export async function GET() {
  try {
    const events = await getEvents();
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
