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
  { file: "alfy mikhael.jpg", name: "Alfy Mikhael", nameAr: "ألفي ميخائيل" },
  { file: "ehab youssef.jpg", name: "Ehab Youssef", nameAr: "إيهاب يوسف" },
  { file: "heba kameel.jpg", name: "Heba Kameel", nameAr: "هبة كميل" },
  { file: "manar khalaf.jpg", name: "Manar Khalaf", nameAr: "منار خلف" },
  { file: "martina adel.jpg", name: "Martina Adel", nameAr: "مارتينا عادل" },
  { file: "michael mansour.jpg", name: "Michael Mansour", nameAr: "مايكل منصور" },
  { file: "michael nabil.jpg", name: "Michael Nabil", nameAr: "مايكل نبيل" },
  { file: "pierre mousa.jpeg", name: "Pierre Mousa", nameAr: "بيير موسى" },
  { file: "randa wagih.jpg", name: "Randa Wagih", nameAr: "راندا وجيه" },
  { file: "youssef nabil.jpg", name: "Youssef Nabil", nameAr: "يوسف نبيل" },
];
