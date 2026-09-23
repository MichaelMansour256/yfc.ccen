import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { isAuthorized } from "@/lib/auth";

export async function DELETE(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { publicId } = await req.json();
  if (!publicId) return NextResponse.json({ error: "publicId required" }, { status: 400 });

  try {
    await cloudinary.uploader.destroy(publicId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
