import { NextResponse } from "next/server";
import { getVerseRef } from "@/lib/verse";

export async function GET() {
  const ref = await getVerseRef();
  if (!ref) return NextResponse.json(null);

  try {
    const res = await fetch(
      `https://api.getbible.net/v2/arabicsv/${ref.book}/${ref.chapter}.json`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const verseObj = data.verses?.find((v: { verse: number }) => v.verse === ref.verse);

    return NextResponse.json({
      ...ref,
      text: verseObj?.text?.trim() ?? "",
      name: verseObj?.name ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch verse" }, { status: 500 });
  }
}
