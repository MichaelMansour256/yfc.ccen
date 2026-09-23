import type { MetadataRoute } from "next";
import { siteConfig, themeConfig } from "@/config";

/**
 * Dynamic PWA manifest generated from the site/theme configuration.
 * (Replaces the former static `public/manifest.json` so a new meeting only
 * edits the config.) Served at /manifest.webmanifest.
 *
 * Every icon listed here is a real file of exactly the declared size in
 * `public/icons/`, generated from `siteConfig.assets.appIcon` by
 * `npm run generate-icons`. That matters: Chrome validates the declaration
 * against the *downloaded* bitmap (and only ever scales bitmaps down), so a
 * declared size that doesn't match the file leaves the installed app without
 * the icon it asked for — the default Chrome icon on the home screen/taskbar.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { pwaIcons } = siteConfig.assets;

  return {
    /** Stable web-app identity, resolved against the manifest URL. */
    id: "/",
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description.ar,
    /** Primary app locale (the site defaults to Arabic) + direction. */
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: themeConfig.colors.dark,
    theme_color: themeConfig.colors.dark,
    orientation: "portrait",
    icons: [
      {
        src: pwaIcons.icon48,
        sizes: "48x48",
        type: "image/png",
        purpose: "any",
      },
      {
        src: pwaIcons.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: pwaIcons.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android adaptive launcher icons. `scripts/generate-pwa-icons.js` pads
      // the artwork into the 80% safe zone, so no launcher mask clips it.
      {
        src: pwaIcons.maskable192,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: pwaIcons.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    /*
     * Only consumed by the install UI ("richer install" sheet / dialog): a real
     * app screenshot (>= 1280x720 with `form_factor: "wide"`) upgrades it, and
     * the branded tile stands in until one exists. The declared size matches
     * the file so the entry stays valid.
     */
    screenshots: [
      {
        src: pwaIcons.icon512,
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
      },
    ],
  };
}