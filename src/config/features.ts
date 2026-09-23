/**
 * Feature flags for the major optional sections.
 * Disabling a feature hides its navigation entries (bottom nav, home quick
 * links, More page, Bible page). The page code itself stays in place — no
 * need to delete components when a meeting doesn't use a section.
 *
 * Deliberately kept to major sections only — do not add flags for every
 * small UI element.
 */
export const features = {
  /** Events page (schedule, invitations, special events). */
  events: true,
  /** Bible section (verse of the week, studies, resources). */
  bible: true,
  /** Games section (Verse Up Arena embed). */
  games: true,
  /** Photo gallery. */
  gallery: true,
  /** Prayer wall. */
  prayerWall: true,
  /** Servants directory. */
  servants: true,
  /** About page. */
  about: true,
  /** Contact page. */
  contact: true,
  /** Push notifications (OneSignal init + bell on the More page). */
  notifications: true,
};

export type FeatureKey = keyof typeof features;

/** Items without a `feature` are always enabled. */
export function isFeatureEnabled(feature?: FeatureKey): boolean {
  return feature === undefined || features[feature];
}
