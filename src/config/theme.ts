/**
 * Theme configuration — the meeting's visual identity.
 *
 * This is the single source of truth for every colour on the site. Nothing else
 * hard-codes a brand colour; `globals.css` only holds SSR fallback copies of
 * these same values.
 *
 * The brand palette
 * -----------------
 * A warm caramel ramp: one base tone, shades darker for surfaces, cream text.
 * Every colour below comes from the design system's token list, so the UI and
 * the logo stay in the same family. No blue, no burgundy, no near-black.
 *
 * On the page background
 * ----------------------
 * The page background is a fixed-angle `linear-gradient(135deg, ...)` running
 * from `--background` through the midpoint to `--background-dark`.
 *
 * This is deliberately NOT the `radial-gradient(ellipse at 50% ...)` the site
 * used to have. A radial gradient with the default `farthest-corner` sizing
 * re-shapes itself to the element's aspect ratio, so one set of stops described
 * a wide warm circle on a desktop window and a tall narrow ellipse on a phone,
 * and the dark stops swallowed most of a phone screen — that was the
 * desktop/mobile colour mismatch, and no media query was involved.
 *
 * A fixed-angle linear gradient has no such re-shaping: the stops sit at fixed
 * percentages along one 135° line, so the viewport only changes where that line
 * crosses the screen, never how the colours are ordered. Because the three stops
 * are also close in tone, the residual difference is not perceptible. The
 * decorative blur blobs are the only other thing painting the background, and
 * they are pinned to the light accent so they can only lighten the tan.
 */
export const themeConfig = {
  /**
   * The palette, in the token names the design system uses. These become the
   * `--brand-*` custom properties.
   */
  brand: {
    /** `--background` — the base tone, and the first background-gradient stop. */
    background: "#9a6b43",
    /**
     * `--background-dark` — the last gradient stop, and the deepest surface tone
     * for chips and panels that sit on top of the page.
     */
    backgroundDark: "#81542f",
    /** `--card` — card and panel fills. Lighter than the page, so cards lift. */
    card: "#a8794d",
    /** `--navbar` — the darkest tone; anchors the navigation bar. */
    navbar: "#694321",
    /** `--accent` — active states, focus rings, filled buttons, hover fills. */
    accent: "#c39a68",
    /** `--accent-hover` — the hover/pressed state of the accent. */
    accentHover: "#b38350",
    /**
     * `--text-primary` — warm cream, not pure white, to sit inside the ramp.
     * Also mapped over Tailwind's `white`, so `text-white` yields this.
     */
    textPrimary: "#fff4e5",
    /** `--text-secondary` — muted text and placeholders. */
    textSecondary: "#e6cba8",
    /** `--border` — hairline borders, dividers and muted surfaces. */
    border: "#b58a5c",
  },

  /**
   * The `blue-*` token names components already use, each pointing at a `brand`
   * entry above. Change the brand palette, not these.
   *
   * `pageBackground` is separate from `dark` because `dark` paints chips and
   * panels that sit *on top of* the page, so it has to be the darker tone.
   */
  colors: {
    /** `--background` — the page background and `<body>`. */
    pageBackground: "#9a6b43",
    /** `--background-dark` — chips, table headers, deep panels. */
    dark: "#81542f",
    /** `--card` — card and panel fills. */
    primary: "#a8794d",
    /** `--border` — borders, dividers, muted surfaces. */
    mid: "#b58a5c",
    /** `--accent` — active states, rings, filled buttons, hover fills. */
    accent: "#c39a68",
    /** `--navbar` — navigation bar fills. */
    navbar: "#694321",
    /** `--accent-hover` — accent hover/pressed. */
    accentHover: "#b38350",
    /** `--text-secondary` — muted text, placeholders, focus rings. */
    light: "#e6cba8",
    /** `--text-primary` — base text colour. */
    white: "#fff4e5",
    /**
     * The three stops of the page background gradient, in order. Applied by
     * `.hero-gradient` / `.page-gradient` / `.page-gradient-high`.
     */
    gradient: {
      start: "#9a6b43",
      mid: "#8f603a",
      end: "#81542f",
    },
  },
};

/**
 * CSS custom properties generated from the theme config.
 * Rendered as an inline `<style>` tag by both root layouts
 * (`src/app/layout.tsx` wrapper + admin) so the config is the single source
 * of truth for colors.
 */
export function themeCssVars(): string {
  const b = themeConfig.brand;
  const c = themeConfig.colors;
  return [
    ":root{",
    // Brand palette — the names the design system uses.
    `--brand-background:${b.background};`,
    `--brand-background-dark:${b.backgroundDark};`,
    `--brand-card:${b.card};`,
    `--brand-navbar:${b.navbar};`,
    `--brand-accent:${b.accent};`,
    `--brand-accent-hover:${b.accentHover};`,
    `--brand-text-primary:${b.textPrimary};`,
    `--brand-text-secondary:${b.textSecondary};`,
    `--brand-border:${b.border};`,
    // Legacy aliases: the `blue-*` names ~60 components already use.
    `--blue-dark:${c.dark};`,
    `--blue-primary:${c.primary};`,
    `--blue-mid:${c.mid};`,
    `--blue-accent:${c.accent};`,
    `--blue-navbar:${c.navbar};`,
    `--blue-accent-hover:${c.accentHover};`,
    `--blue-light:${c.light};`,
    `--white:${c.white};`,
    // Page background gradient stops, in order.
    `--gradient-start:${c.gradient.start};`,
    `--gradient-mid:${c.gradient.mid};`,
    `--gradient-end:${c.gradient.end};`,
    "}",
  ].join("");
}
