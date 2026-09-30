import { localized, type LocalizedText } from "@/lib/localized";

/**
 * Servants directory.
 *
 * Photos live in `public/servants images/` — drop a new photo there and add
 * an entry below (paths are served from the site root, keep the folder name
 * as-is or update `SERVANTS_DIR` if you rename it).
 */
export interface Servant {
  /** Photo file name inside the servants images folder. */
  file: string;
  /**
   * The servant's name, in both languages.
   *
   * This used to be `name` (English) + `nameAr` (Arabic) as two loose fields,
   * and the page only ever read `nameAr` — which is why /en/more/servants
   * rendered an Arabic heading and Arabic names. A single bilingual value
   * makes it impossible to read "the Arabic field" by accident: the page asks
   * for the active locale and gets that locale's value.
   */
  name: LocalizedText;
  /** Optional role within the meeting (localized the same way). */
  role?: LocalizedText;
}

/** Public URL prefix for servant photos (folder name contains a space). */
export const SERVANTS_DIR = "/servants images";

/**
 * Page heading. This is UI copy, not content, so it lives in
 * `messages/{locale}.json` under `more.servants` — the same key the More menu
 * already used. The old `servantsTitleAr` constant was a hard-coded Arabic
 * string that no locale could override.
 */

export const servants: Servant[] = [
  { file: "ehab youssef.jpg", name: localized("إيهاب يوسف", "Ehab Youssef") },
  { file: "samira boshra.jpg", name: localized("سميرة بشرى", "Samira Boshra") },
  { file: "reham adly.jpg", name: localized("ريهام عدلي", "Reham Adly") },
  { file: "amani gad.jpg", name: localized("أماني جاد", "Amani Gad") },
  { file: "mariam samy.jpg", name: localized("مريم سامي", "Mariam Samy") },
  { file: "essam raafat.jpg", name: localized("عصام رأفت", "Essam Raafat") },
  { file: "raafat shoukry.jpg", name: localized("رأفت شكري", "Raafat Shoukry") },
  { file: "merna rezk.jpg", name: localized("ميرنا رزق", "Merna Rezk") },
  { file: "jozef rizk.jpg", name: localized("چوزيف رزق", "Jozef Rizk") },
  { file: "ramez malak.jpg", name: localized("رامز ملاك", "Ramez Malak") },
];

