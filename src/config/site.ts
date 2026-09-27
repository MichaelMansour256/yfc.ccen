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
  name: "Youth For Christ Meeting",
  /** Short name (installed-app title, admin pages). */
  shortName: "Youth For Christ",
  /** Site description (SEO metadata + PWA manifest). */
  description: {
    en: "Youth For Christ Meeting – Christ Church Ezbet El Nakhl",
    ar: "إحنا شباب المسيح · كنيسة المسيح – عزبة النخل",
  },
  /**
   * Public site URL — base for push-notification click-through links.
   * Override with NEXT_PUBLIC_SITE_URL (set it in production so notification
   * links always point at the deployed site, not the local dev server).
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://yfc-ccen.vercel.app",

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
    { name: "Facebook", url: "https://www.facebook.com/profile.php?id=61565610140238" },
    { name: "Instagram", url: "https://www.instagram.com/yfc_meeting" },
    { name: "TikTok", url: "https://www.tiktok.com/@yfcmeeting" },
    { name: "SoundCloud", url: "https://soundcloud.com/youth-christ-church" }
    // { name: "Linktree", url: "https://linktr.ee/youth.for.christ" },
  ] satisfies SocialLink[],

  /** Branding assets under /public — replace these files for a new meeting. */
  assets: {
    /**
     * Round logo shown on the home hero and about page.
     * The artwork is vector (SVG) and doubles as a decorative display mark.
     * The Arabic/English wordmark is NOT part of the app icon — the site renders
     * the meeting name as live text from `meetingConfig`, which keeps it
     * editable and translatable.
     */
    logo: "/logo.svg",
    /**
     * App/PWA icon (also shown in the install banner and as the source for every
     * generated raster icon). This is the text-free brand mark: `npm run
     * generate-appstore-icons` derives the whole `public/appstore-images/` set
     * and `npm run generate-icons` the `public/icons/` set from this one file.
     */
    appIcon: "/app-icon.png",
    /**
     * Exact-size PWA icons generated from `appIcon` by `npm run generate-icons`
     * — every file has exactly the size its manifest entry declares, because
     * browsers validate the declaration against the downloaded bitmap (a
     * mismatch leaves the installed app without the icon it asked for).
     * Regenerate them after replacing `appIcon`.
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
   * meeting can reuse the same cloud without touching another meeting's data).
   */
  cloudinary: {
    meetingFolder: process.env.CLOUDINARY_MEETING_FOLDER ?? "yfc_events",
  },
};

export type SiteConfig = typeof siteConfig;
