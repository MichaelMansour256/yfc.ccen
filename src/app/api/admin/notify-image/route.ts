import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { isAuthorized } from "@/lib/auth";

/**
 * Upload a one-off notification image from the admin's device.
 * Auth: x-admin-password header. Body: multipart FormData { file }.
 * Stores under `notifications/` with a timestamped public_id so it never
 * collides with invitation dates. Returns { url }.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const result = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "notifications",
            public_id: `manual-${stamp}`,
            overwrite: true,
            resource_type: "image",
          },
          (err, res) => (err || !res ? reject(err) : resolve(res))
        )
        .end(buffer);
    }
  );

  return NextResponse.json({ url: result.secure_url, publicId: result.public_id });
}
