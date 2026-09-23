import type { FeatureKey } from "./features";

/**
 * Central navigation configuration.
 *
 * `key` is the next-intl translation key inside the namespace the rendering
 * component uses (`nav`, `more`, `bible`), so labels keep coming from
 * `messages/{locale}.json` while the structure lives here.
 */
export interface NavItem {
  /** Translation key, e.g. `events` → `nav.events`, `gallery` → `more.gallery`. */
  key: string;
  /** Path relative to the locale root: "/" or "/more/gallery". */
  href: string;
  /** Emoji icon. */
  icon: string;
  /** Feature gate — the item is hidden when the feature is disabled. */
  feature?: FeatureKey;
}

/** Bottom navigation tabs. */
export const bottomNavTabs: NavItem[] = [
  { key: "home", href: "/", icon: "🏠" },
  { key: "events", href: "/events", icon: "📅", feature: "events" },
  { key: "bible", href: "/bible", icon: "📖", feature: "bible" },
  { key: "games", href: "/games", icon: "🎮", feature: "games" },
  { key: "more", href: "/more", icon: "☰" },
];

/** Home page quick-access grid — the bottom tabs minus "home". */
export const homeQuickLinks: NavItem[] = bottomNavTabs.filter(
  (t) => t.key !== "home"
);

/** Items listed on the "More" page (keys from the `more` namespace). */
export const moreMenuItems: NavItem[] = [
  { key: "about", href: "/more/about", icon: "ℹ️", feature: "about" },
  { key: "gallery", href: "/more/gallery", icon: "🖼️", feature: "gallery" },
  { key: "servants", href: "/more/servants", icon: "🙏", feature: "servants" },
  { key: "prayerWall", href: "/more/prayer-wall", icon: "✝️", feature: "prayerWall" },
  { key: "contact", href: "/more/contact", icon: "📬", feature: "contact" },
];

/** Sections listed on the "Bible" page (keys from the `bible` namespace). */
export const bibleSections: NavItem[] = [
  { key: "verseOfWeek", href: "/bible/verse", icon: "✨", feature: "bible" },
  { key: "studies", href: "/bible/studies", icon: "📚", feature: "bible" },
  { key: "resources", href: "/bible/resources", icon: "🗂️", feature: "bible" },
];
