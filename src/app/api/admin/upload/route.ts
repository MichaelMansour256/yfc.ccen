import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { isAuthorized } from "@/lib/auth";

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const folder = formData.get("folder") as string;
  const files = formData.getAll("files") as File[];

  if (!folder || !files.length) {
    return NextResponse.json({ error: "Folder and files required" }, { status: 400 });
  }

  try {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return new Promise<{ public_id: string; secure_url: string }>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream({ folder, resource_type: "image" }, (err, result) => {
              if (err || !result) return reject(err);
              resolve({ public_id: result.public_id, secure_url: result.secure_url });
            })
            .end(buffer);
        });
      })
    );
    return NextResponse.json({ uploaded: uploads });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
