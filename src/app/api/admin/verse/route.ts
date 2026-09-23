import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { saveVerseRef } from "@/lib/verse";

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { book, bookName, chapter, verse, note } = body;

  if (!book || !chapter || !verse) {
    return NextResponse.json({ error: "book, chapter and verse are required" }, { status: 400 });
  }

  await saveVerseRef({ book: Number(book), bookName, chapter: Number(chapter), verse: Number(verse), note });
  return NextResponse.json({ success: true });
}
