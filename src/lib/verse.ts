import cloudinary from "./cloudinary";
import { siteConfig } from "@/config";

export type VerseRef = {
  book: number;
  bookName: string;
  chapter: number;
  verse: number;
  note?: string; // optional servant note
};

// Stored as a raw JSON resource under the meeting's Cloudinary namespace
// (`siteConfig.cloudinary.meetingFolder`, default "e3dady_events").
const PUBLIC_ID = `${siteConfig.cloudinary.meetingFolder}/verse_of_week`;

export async function getVerseRef(): Promise<VerseRef | null> {
  try {
    const result = await cloudinary.api.resource(PUBLIC_ID, { resource_type: "raw" });
    const res = await fetch(result.secure_url + `?t=${Date.now()}`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveVerseRef(ref: VerseRef): Promise<void> {
  const buffer = Buffer.from(JSON.stringify(ref));
  await new Promise<void>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { public_id: PUBLIC_ID, resource_type: "raw", overwrite: true },
        (err) => (err ? reject(err) : resolve())
      )
      .end(buffer);
  });
}
