import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { isAuthorized } from "@/lib/auth";

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const date = formData.get("date") as string;
  const file = formData.get("file") as File;

  if (!date || !file) return NextResponse.json({ error: "date and file required" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: "invitations", public_id: date, overwrite: true, resource_type: "image" },
        (err, res) => (err || !res ? reject(err) : resolve(res))
      )
      .end(buffer);
  });

  return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
}

export async function DELETE(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { publicId } = await req.json();
  if (!publicId) return NextResponse.json({ error: "publicId required" }, { status: 400 });

  await cloudinary.uploader.destroy(publicId);
  return NextResponse.json({ success: true });
}
