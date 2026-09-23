/**
 * Site configuration — shared identity used across the whole site
 * (metadata, PWA manifest, hero, contact page, push notifications).
 * Meeting-specific content (name, schedule, about text) lives in `meeting.ts`.
 */
export interface SocialLink {
  /** Network name — also used to pick the icon (see `SocialLinks.tsx`). */
  name: string;
  url: string;
}

export const siteConfig = {
  /** Full site/meeting title (browser tabs, PWA manifest name). */
  name: "E3dady Youth Meeting",
  /** Short name (installed-app title, admin pages). */
  shortName: "E3dady",
  /** Site description (SEO metadata + PWA manifest). */
  description: {
    en: "E3dady Youth Meeting – Christ Church Ezbet El Nakhl",
    ar: "اجتماع شباب إعدادي · كنيسة المسيح – عزبة النخل",
  },
  /**
   * Public site URL — base for push-notification click-through links.
   * Override with NEXT_PUBLIC_SITE_URL (set it in production so notification
   * links always point at the deployed site, not the local dev server).
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://e3dady-ccen.vercel.app",

  /** The church this meeting belongs to. */
  church: {
    name: "Christ Church – Ezbet El Nakhl",
    nameAr: "كنيسة المسيح – عزبة النخل",
  },

  /**
   * Contact details. The current site does not display an email or phone
   * anywhere; fill these in if a future design renders them.
   */
  contact: {
    email: "",
    phone: "",
  },

  /** Social links (rendered on the home hero and the contact page). */
  social: [
    { name: "Facebook", url: "https://www.facebook.com/e3dady.ccen" },
    { name: "Instagram", url: "https://www.instagram.com/e3dady.ccen" },
    { name: "TikTok", url: "https://www.tiktok.com/@e3dady.ccen" },
    { name: "YouTube", url: "https://www.youtube.com/@e3dady_ccen" },
    { name: "Linktree", url: "https://linktr.ee/e3dady.ccen" },
  ] satisfies SocialLink[],

  /** Branding assets under /public — replace these files for a new meeting. */
  assets: {
    /** Round logo shown on the home hero and about page. */
    logo: "/logo.png",
    /** App/PWA icon (also used as notification icon). */
    appIcon: "/app-icon.png",
    /**
     * Exact-size PWA icons generated from `appIcon` by `npm run generate-icons`
     * — every file has exactly the size its manifest entry declares, because
     * browsers validate the declaration against the downloaded bitmap (a
     * mismatch leaves the installed app without the icon it asked for).
     * Regenerate them after replacing `app-icon.png`.
     */
    pwaIcons: {
      /** Browser tab icon (transparent corners). */
      icon48: "/icons/icon-48x48.png",
      /** Manifest icons with `purpose: "any"`. */
      icon192: "/icons/icon-192x192.png",
      icon512: "/icons/icon-512x512.png",
      /** Manifest icons with `purpose: "maskable"` (Android adaptive icon). */
      maskable192: "/icons/maskable-192x192.png",
      maskable512: "/icons/maskable-512x512.png",
      /** iOS home-screen icon (opaque — iOS paints transparency black). */
      appleTouch180: "/icons/apple-touch-icon-180x180.png",
    },
  },

  /**
   * Cloudinary namespace that stores this meeting's app data:
   * `<meetingFolder>/events` (special-events JSON) and
   * `<meetingFolder>/verse_of_week` (verse JSON). Gallery event folders and
   * the `invitations` folder live outside it in the same cloud account.
   * Override with CLOUDINARY_MEETING_FOLDER for a new meeting (so a fresh
   * meeting can reuse the same cloud without touching E3dady's data).
   */
  cloudinary: {
    meetingFolder: process.env.CLOUDINARY_MEETING_FOLDER ?? "e3dady_events",
  },
};

export type SiteConfig = typeof siteConfig;
