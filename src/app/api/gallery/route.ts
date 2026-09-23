import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { siteConfig } from "@/config";

// Hide the app-data folders (invitation images + meeting JSON namespace)
// from the public gallery.
const EXCLUDED_FOLDERS = ["invitations","notifications", siteConfig.cloudinary.meetingFolder];

export async function GET() {
  try {
    const { folders } = await cloudinary.api.root_folders();

    const visibleFolders = folders.filter(
      (f: { name: string; path: string }) => !EXCLUDED_FOLDERS.includes(f.path)
    );

    const events = await Promise.all(
      visibleFolders.map(async (folder: { name: string; path: string }) => {
        const { resources } = await cloudinary.search
          .expression(`folder:"${folder.path}"`)
          .sort_by("created_at", "desc")
          .max_results(500)
          .execute();

        return {
          name: folder.name,
          path: folder.path,
          photos: resources.map((r: { public_id: string; secure_url: string; width: number; height: number }) => ({
            id: r.public_id,
            url: r.secure_url,
            width: r.width,
            height: r.height,
          })),
        };
      })
    );

    return NextResponse.json(events.filter((e) => e.photos.length > 0));
  } catch {
    return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 500 });
  }
}
