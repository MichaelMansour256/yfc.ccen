#!/usr/bin/env node
/**
 * Generates the exact-size PWA icon set in `public/icons/` from the meeting's
 * artwork (`public/app-icon.png`).
 *
 * Why this exists
 * ---------------
 * `src/app/manifest.ts` and `src/app/layout.tsx` declare icon `sizes` for every
 * entry they list, and browsers validate that declaration against the
 * *downloaded* bitmap instead of trusting it (Chrome: `ManifestIconDownloader`
 * discards a download whose real dimensions are not square / not big enough,
 * and only ever scales a bitmap *down* to the size it asked for). So pointing
 * every entry at one 1254x1254 file while declaring 192x192/512x512 makes
 * Chrome download a 1.4 MB PNG for each slot and leaves the installed app
 * without the icon it asked for — which shows up as the default Chrome icon on
 * the home screen / taskbar. Every file written here has exactly the size its
 * manifest entry declares.
 *
 * Where the artwork comes from
 * ---------------------------
 * The analysis and rendering are shared with `generate-appstore-icons.js`, so
 * the installed-PWA icon and the app-store icons are byte-for-byte the same
 * artwork, derived the same way, from the same source file. That script owns
 * the two subtleties this one used to get wrong:
 *
 * - the source logo is a rounded tan tile whose *corners* are white, so
 *   measuring "the brightest pixels" measures the whole canvas. The shared
 *   flood fill separates the mark from the tile's corner treatment.
 * - Android masks the adaptive icon to a 72dp circle within the 108dp layer and
 *   guarantees only the inner 66dp. The mark already occupies ~61% of the tile,
 *   i.e. ~66dp of a 108dp layer, so it sits inside every standard mask without
 *   any extra padding — the old 80%-safe-zone shrink is deliberately not
 *   applied, because it would only shrink an already-safe mark.
 *
 * Usage (after replacing the artwork in `public/`):
 *     npm run generate-icons
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { readArtwork, render, SOURCE } = require("./generate-appstore-icons");

/** Output directory — `siteConfig.assets.pwaIcons`. */
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

/** `purpose: "any"` icons. Keep in sync with the manifest + layout metadata. */
const ANY_SIZES = [48, 192, 512];
/** `purpose: "maskable"` icons (Android adaptive / web app manifest). */
const MASKABLE_SIZES = [192, 512];
/** Single iOS home-screen icon (`rel="apple-touch-icon"`). */
const APPLE_TOUCH_SIZE = 180;

/** Lossless PNG output options — compressed as far as sharp allows. */
const PNG = { compressionLevel: 9, adaptiveFiltering: true, palette: false };

/**
 * Writes one opaque icon. iOS paints transparent pixels black on the home
 * screen and the manifest's `any` entries are better off flat, so these are
 * RGB with no alpha channel.
 */
async function writeIcon(size, file) {
  const target = path.join(OUT_DIR, file);
  const buffer = await render(art.mark, art, size, size);
  await fs.writeFile(target, buffer);
  return target;
}

let art;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  art = await readArtwork();

  console.log(
    `artwork   ${path.relative(path.join(__dirname, ".."), SOURCE)} ${art.sourceSize}x${art.sourceSize}` +
      ` · mark ${art.markW}x${art.markH}` +
      ` (${(art.ratioW * 100).toFixed(2)}% x ${(art.ratioH * 100).toFixed(2)}% of the tile)`
  );

  const report = async (target) => {
    const { size } = await fs.stat(target);
    console.log(`  ${path.basename(target).padEnd(30)} ${Math.round(size / 1024)} KB`);
  };

  for (const size of ANY_SIZES) {
    await report(await writeIcon(size, `icon-${size}x${size}.png`));
  }
  // Maskable at the source proportion: the mark is already inside the 66dp
  // safe circle of a 108dp layer, so no padding is applied.
  for (const size of MASKABLE_SIZES) {
    await report(await writeIcon(size, `maskable-${size}x${size}.png`));
  }
  await report(await writeIcon(APPLE_TOUCH_SIZE, `apple-touch-icon-${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE}.png`));

  console.log(
    `wrote ${ANY_SIZES.length + MASKABLE_SIZES.length + 1} files to public/icons/`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
