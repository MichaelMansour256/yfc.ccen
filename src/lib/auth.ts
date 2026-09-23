import { timingSafeEqual } from "crypto";

export function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("x-admin-password");
  if (!auth || !process.env.ADMIN_PASSWORD) return false;
  try {
    return timingSafeEqual(
      Buffer.from(auth),
      Buffer.from(process.env.ADMIN_PASSWORD)
    );
  } catch {
    return false;
  }
}
