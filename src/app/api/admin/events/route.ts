import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getEvents, saveEvents, SpecialEvent } from "@/lib/events";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, titleAr, date, time, description, descriptionAr } = body;

  if (!title || !date || !time) {
    return NextResponse.json({ error: "title, date and time are required" }, { status: 400 });
  }

  const events = await getEvents();
  const newEvent: SpecialEvent = {
    id: randomUUID(),
    title,
    titleAr: titleAr ?? title,
    date,
    time,
    description,
    descriptionAr,
  };

  events.push(newEvent);
  events.sort((a, b) => a.date.localeCompare(b.date));
  await saveEvents(events);

  return NextResponse.json(newEvent);
}

export async function DELETE(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const events = await getEvents();
  await saveEvents(events.filter((e) => e.id !== id));

  return NextResponse.json({ success: true });
}
