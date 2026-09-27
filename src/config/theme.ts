/**
 * Theme configuration — the meeting's visual identity.
 *
 * This is the single source of truth for every colour on the site. Nothing else
 * hard-codes a brand colour; `globals.css` only holds SSR fallback copies of
 * these same values.
 *
 * The brand palette
 * -----------------
 * Sampled from the meeting's own logo (`public/app-icon.png`), whose field is a
 * flat `#BE9366`. Every colour below is that tan or a tint/shade of it, so the
 * UI and the logo are visibly the same brand. No blue, no burgundy, no
 * near-black.
 *
 * Why the page background is a FLAT colour
 * ---------------------------------------
 * The background used to be `radial-gradient(ellipse at 50% ..., ...)`. A radial
 * gradient with the default `farthest-corner` sizing re-shapes itself to the
 * element's aspect ratio, so identical stops describe a circle on a wide
 * desktop window and a tall narrow ellipse on a phone — the warm band and the
 * dark band land in different places on the two. A flat fill has no geometry, so
 * desktop and mobile are now guaranteed to be the same colour. Depth comes from
 * the decorative blur blobs instead, which can only *lighten* the tan.
 */
export const themeConfig = {
  /**
   * The palette, in the token names the design system uses. These become the
   * `--brand-*` custom properties.
   */
  brand: {
    /**
     * Primary. The logo's own field colour, and the page background. Sampled
     * from `public/app-icon.png` rather than eyeballed.
     */
    tan: "#be9366",
    /** Lighter tint. Highlights and decorative glows; can only lighten. */
    tanLight: "#e3c6a3",
    /** Deeper shade. Borders and anything that must read against `tan`. */
    tanDark: "#8a5a2b",
    /** Deepest shade. Card surfaces, chips, ring offsets. */
    tanDeep: "#5f3a18",
    /** Muted body text on the tan background. */
    textDark: "#4a2c12",
    white: "#ffffff",
    /** Primary text colour, per the brand direction (white on tan). */
    text: "#ffffff",
    /** Hairline borders — warm and low-contrast by design. */
    border: "rgba(95, 58, 24, 0.22)",
    /** Card fill — white translucency, so it lightens the tan on any surface. */
    card: "rgba(255, 255, 255, 0.16)",
  },

  /**
   * Legacy token values, kept under the names components already use. Every one
   * is an alias into `brand` above — change the brand palette, not these.
   *
   * `pageBackground` is deliberately separate from `dark`: `dark` is used for
   * card/chip surfaces that sit *on top of* the page (`bg-blue-dark/60`), so it
   * must stay darker than the page, while the page itself is the light tan.
   */
  colors: {
    /** Page background, `<body>`, and every `page-gradient` surface. */
    pageBackground: "#be9366",
    /** Deepest tan — chips, table headers, ring offsets. */
    dark: "#5f3a18",
    /** Card / panel fills. */
    primary: "#a9743f",
    /** Borders and muted surfaces. */
    mid: "#8a5a2b",
    /** Accent — active states, rings, filled buttons. */
    accent: "#5f3a18",
    /**
     * Secondary text and focus rings. This is a *dark* tan because it is used as
     * text on the light page background; a light value here would be unreadable
     * now that the page is light.
     */
    light: "#4a2c12",
    /** Base text colour. */
    white: "#ffffff",
    /**
     * Retained for compatibility. The page background is flat now, so these are
     * only a subtle tint of the tan, not the old dark browns.
     */
    gradient: {
      mid: "#c9a175",
      dark: "#be9366",
      deeper: "#b3875a",
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
    `--brand-tan:${b.tan};`,
    `--brand-tan-light:${b.tanLight};`,
    `--brand-tan-dark:${b.tanDark};`,
    `--brand-tan-deep:${b.tanDeep};`,
    `--brand-text-dark:${b.textDark};`,
    `--brand-white:${b.white};`,
    `--brand-text:${b.text};`,
    `--brand-border:${b.border};`,
    `--brand-card:${b.card};`,
    // Page background, separate from the surface tokens.
    `--brand-page:${c.pageBackground};`,
    // Legacy aliases: the `blue-*` names ~60 components already use.
    `--blue-dark:${c.dark};`,
    `--blue-primary:${c.primary};`,
    `--blue-mid:${c.mid};`,
    `--blue-accent:${c.accent};`,
    `--blue-light:${c.light};`,
    `--white:${c.white};`,
    `--gradient-mid:${c.gradient.mid};`,
    `--gradient-dark:${c.gradient.dark};`,
    `--gradient-deeper:${c.gradient.deeper};`,
    "}",
  ].join("");
}
