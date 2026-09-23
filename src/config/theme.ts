/**
 * Theme configuration — the meeting's visual identity.
 *
 * How theming works in this project (Tailwind CSS v4):
 * - `globals.css` declares CSS custom properties (`--blue-dark`,
 *   `--blue-primary`, …) and maps them to Tailwind tokens via `@theme inline`
 *   (so utilities like `bg-blue-dark`, `text-blue-accent` keep working).
 * - The root layouts inject the values below as a `<style>` tag, overriding
 *   the `globals.css` fallbacks at runtime.
 * - The token NAMES (`blue-*`) are legacy names kept for compatibility —
 *   they do NOT have to be blue. Only the VALUES below need to change for a
 *   new visual identity; no component edits required.
 *
 * After changing values here, also update the fallback copies in
 * `globals.css` (`:root`) so the first paint doesn't flash the old colors.
 */
export const themeConfig = {
  colors: {
    /** Page background / darkest brand tone (maps to `--blue-dark`). */
    dark: "#0f1f5c",
    /** Primary brand tone, surfaces and cards (maps to `--blue-primary`). */
    primary: "#1a3a8f",
    /** Mid brand tone, borders and muted surfaces (maps to `--blue-mid`). */
    mid: "#1e40af",
    /** Accent — active states, highlights, links (maps to `--blue-accent`). */
    accent: "#3b82f6",
    /** Light secondary text on dark background (maps to `--blue-light`). */
    light: "#93c5fd",
    /** Base text color (maps to `--white`). */
    white: "#ffffff",
    /**
     * Radial background-gradient stops used by `.hero-gradient`,
     * `.page-gradient` and `.page-gradient-high` in `globals.css`.
     */
    gradient: {
      mid: "#1a4db5",
      dark: "#0f1f5c",
      deeper: "#060d2e",
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
  const c = themeConfig.colors;
  return [
    ":root{",
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
