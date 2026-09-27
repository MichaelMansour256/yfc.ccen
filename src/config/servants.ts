/**
 * Servants directory.
 * Photos live in `public/servants images/` — drop a new photo there and add
 * an entry below (paths are served from the site root, keep the folder name
 * as-is or update `SERVANTS_DIR` if you rename it).
 */
export interface Servant {
  /** Photo file name inside the servants images folder. */
  file: string;
  /** Name (English). */
  name: string;
  /** Name (Arabic) — the one displayed on the cards. */
  nameAr: string;
  /** Optional role within the meeting. */
  role?: string;
}

/** Public URL prefix for servant photos (folder name contains a space). */
export const SERVANTS_DIR = "/servants images";

/** Servants page title (kept Arabic, matching the current UI). */
export const servantsTitleAr = "الخدام";

export const servants: Servant[] = [
  
  { file: "ehab youssef.jpg", name: "Ehab Youssef", nameAr: "إيهاب يوسف" }
  
];
