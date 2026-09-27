#!/usr/bin/env node
/**
 * Generates the exact-size PWA icon set in `public/icons/` from the meeting's
 * artwork (`public/logo.svg`, or a square `public/app-icon.png`).
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
 * Maskable icons (Android adaptive launcher icons) are generated too, because
 * without one the Android launcher wraps the icon in its own generic padding.
 *
 * Usage (after replacing the artwork in `public/`):
 *     npm run generate-icons
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

/** Output directory — `siteConfig.assets.pwaIcons`. */
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

/**
 * Artwork the icons are derived from — `siteConfig.assets.appIcon`.
 *
 * Vector (`.svg`) is preferred and rasterised by sharp, so the branding can
 * live as a single crisp source file that needs no export step; a square
 * `.png` is still accepted as a fallback.
 */
const SOURCE_CANDIDATES = ["logo.svg", "app-icon.svg", "app-icon.png"].map((file) =>
  path.join(__dirname, "..", "public", file)
);

/** First existing artwork file, or a helpful error naming the accepted names. */
async function resolveSource() {
  for (const candidate of SOURCE_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Not there — fall through to the next candidate.
    }
  }
  throw new Error(
    `no icon artwork found in public/ — expected one of: ${SOURCE_CANDIDATES.map((file) =>
      path.basename(file)
    ).join(", ")}`
  );
}

/** `purpose: "any"` icons. Keep in sync with the manifest + layout metadata. */
const ANY_SIZES = [48, 192, 512];
/** `purpose: "maskable"` icons (Android). */
const MASKABLE_SIZES = [192, 512];
/** Single iOS home-screen icon (`rel="apple-touch-icon"`). */
const APPLE_TOUCH_SIZE = 180;

/**
 * Android crops maskable icons to a centred circle of 80% of the icon width, so
 * the artwork must fit inside a circle of 40% of the size (minus a margin so
 * anti-aliased edges are never clipped).
 */
const SAFE_RADIUS_RATIO = 0.39;

/** Pixels at least this bright belong to the white emblem, not the background. */
const ART_LUMINANCE = 190;
/** Where the artwork's background gradient is sampled (fraction of its width). */
const GRADIENT_SAMPLE_AT = 0.14;
/** PNG output options — lossless, but compressed as far as sharp allows. */
const PNG = { compressionLevel: 9, adaptiveFiltering: true };

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
const round1 = (v) => Math.round(v * 10) / 10;

/**
 * Measures the artwork instead of hard-coding numbers, so replacing
 * `app-icon.png` with new art only requires re-running this script:
 *
 * - the white emblem's bounding box (how much of the tile is content),
 * - the distance from the tile centre to its furthest emblem pixel (used to
 *   scale maskable icons into the Android safe circle),
 * - the background gradient's two stops (so the padding painted behind the
 *   rounded tile matches the tile's own colours and has no visible seam).
 */
async function inspectArtwork(source) {
  const { width, height } = await sharp(source).metadata();
  if (!width || width !== height) {
    throw new Error(
      `${path.basename(source)} must be square artwork (got ${width}x${height})`
    );
  }

  const { data } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const isEmblem = (x, y) => {
    const [r, g, b, a] = pixel(x, y);
    return a >= 128 && 0.2126 * r + 0.7152 * g + 0.0722 * b >= ART_LUMINANCE;
  };

  const box = { minX: width, minY: height, maxX: -1, maxY: -1 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isEmblem(x, y)) continue;
      if (x < box.minX) box.minX = x;
      if (x > box.maxX) box.maxX = x;
      if (y < box.minY) box.minY = y;
      if (y > box.maxY) box.maxY = y;
    }
  }
  if (box.maxX < 0) {
    throw new Error(
      `no emblem pixels brighter than ${ART_LUMINANCE} found in ${path.basename(source)}`
    );
  }

  // Furthest emblem pixel from the tile centre — the radius a maskable icon
  // has to keep inside the safe circle.
  const cx = width / 2;
  const cy = height / 2;
  let radius = 0;
  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      if (!isEmblem(x, y)) continue;
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > radius) radius = distance;
    }
  }

  // Sampled outside the emblem's bounding box, so both stops are pure background.
  const at = Math.round(width * GRADIENT_SAMPLE_AT);
  const end = width - at - 1;

  return {
    width,
    height,
    emblem: {
      width: box.maxX - box.minX + 1,
      height: box.maxY - box.minY + 1,
    },
    radius,
    gradient: { from: hex(pixel(at, at)), to: hex(pixel(end, end)) },
  };
}

/** Full-bleed background that continues the artwork's own gradient behind it. */
function backgroundSvg(size, gradient) {
  const offset = `${round1(GRADIENT_SAMPLE_AT * 100)}%`;
  const end = `${round1((1 - GRADIENT_SAMPLE_AT) * 100)}%`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<defs><linearGradient id="g" x1="${offset}" y1="${offset}" x2="${end}" y2="${end}">` +
      `<stop offset="0" stop-color="${gradient.from}"/>` +
      `<stop offset="1" stop-color="${gradient.to}"/>` +
      `</linearGradient></defs>` +
      `<rect width="${size}" height="${size}" fill="url(#g)"/></svg>`
  );
}

/** Lossless resize that keeps the tile's transparent rounded corners. */
async function writePlainIcon(size, file, source) {
  const target = path.join(OUT_DIR, file);
  await sharp(source).resize(size, size, { fit: "cover" }).png(PNG).toFile(target);
  return target;
}

/**
 * Writes one generated icon: the artwork scaled to `fraction` of the canvas and
 * centred on the gradient background. `fraction: 1` fills the canvas (only the
 * tile's transparent rounded corners show the background); smaller fractions pad
 * the artwork so it stays inside the Android safe circle.
 */
async function writePaddedIcon(size, fraction, gradient, file, source) {
  const target = path.join(OUT_DIR, file);
  const tileSize = Math.round(size * fraction);
  const offset = Math.round((size - tileSize) / 2);
  const tile = await sharp(source)
    .resize(tileSize, tileSize, { fit: "cover" })
    .png()
    .toBuffer();

  await sharp(backgroundSvg(size, gradient))
    .composite([{ input: tile, left: offset, top: offset }])
    .png(PNG)
    .toFile(target);
  return target;
}

async function main() {
  const source = await resolveSource();
  const art = await inspectArtwork(source);
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(
    `artwork   ${path.relative(path.join(__dirname, ".."), source)} ${art.width}x${art.height}` +
      ` · emblem ${art.emblem.width}x${art.emblem.height}` +
      ` · emblem radius ${round1(art.radius)}px` +
      ` · gradient ${art.gradient.from} → ${art.gradient.to}`
  );

  const report = async (target) => {
    const { size } = await fs.stat(target);
    console.log(`  ${path.basename(target).padEnd(30)} ${Math.round(size / 1024)} KB`);
  };

  for (const size of ANY_SIZES) {
    await report(await writePlainIcon(size, `icon-${size}x${size}.png`, source));
  }

  const safeFraction = Math.min(1, (SAFE_RADIUS_RATIO * art.width) / art.radius);
  for (const size of MASKABLE_SIZES) {
    await report(
      await writePaddedIcon(
        size,
        safeFraction,
        art.gradient,
        `maskable-${size}x${size}.png`,
        source
      )
    );
  }

  // iOS ignores transparency (it renders transparent pixels black), so the
  // home-screen icon is the tile composited onto the gradient instead.
  await report(
    await writePaddedIcon(
      APPLE_TOUCH_SIZE,
      1,
      art.gradient,
      `apple-touch-icon-${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE}.png`,
      source
    )
  );

  console.log(
    `maskable   artwork at ${round1(safeFraction * 100)}% of the canvas` +
      ` · wrote ${ANY_SIZES.length + MASKABLE_SIZES.length + 1} files to public/icons/`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
