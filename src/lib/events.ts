import cloudinary from "./cloudinary";
import { siteConfig } from "@/config";

export type SpecialEvent = {
  id: string;
  title: string;
  titleAr: string;
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:MM
  description?: string;
  descriptionAr?: string;
};

// Stored as a raw JSON resource under the meeting's Cloudinary namespace
// (`siteConfig.cloudinary.meetingFolder`, default "e3dady_events").
const PUBLIC_ID = `${siteConfig.cloudinary.meetingFolder}/events`;

export async function getEvents(): Promise<SpecialEvent[]> {
  try {
    const result = await cloudinary.api.resource(PUBLIC_ID, { resource_type: "raw" });
    const res = await fetch(result.secure_url + `?t=${Date.now()}`);
    return await res.json();
  } catch {
    return [];
  }
}

export async function saveEvents(events: SpecialEvent[]): Promise<void> {
  const buffer = Buffer.from(JSON.stringify(events));
  await new Promise<void>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { public_id: PUBLIC_ID, resource_type: "raw", overwrite: true },
        (err) => (err ? reject(err) : resolve())
      )
      .end(buffer);
  });
}
