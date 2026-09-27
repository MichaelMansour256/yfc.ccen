#!/usr/bin/env node
/**
 * Generates every platform icon set in `public/appstore-images/` from the NEW
 * Youth For Christ logo.
 *
 * Source of truth
 * ---------------
 * `public/app-icon.png` — the new logo (warm tan tile, white YFC + cross mark,
 * no Arabic/English text). It is the highest-resolution copy of the artwork in
 * the repo, so every asset here is a *downscale* of it; nothing is ever
 * upscaled from a thumbnail and nothing is redrawn.
 *
 * How the artwork is reused verbatim
 * ---------------------------------
 * The logo is exactly two flat colours — a solid tan field and a white mark —
 * so the script never repaints it. It derives a real alpha mask for the white
 * mark by projecting every pixel onto the tan -> white colour axis, which
 * reproduces the artwork's anti-aliased edges exactly:
 *
 *     alpha = dot(pixel - tan, white - tan) / |white - tan|^2
 *
 * and it flood-fills the white that touches the image border first, so the
 * rounded corners of the tile are discarded instead of being mistaken for part
 * of the mark. The mask is then placed on a flat tan field, i.e. the logo with
 * the platform doing the corner rounding — which is what every app store and
 * launcher expects (iOS applies its own mask, Google Play masks the 512 icon,
 * Android's adaptive mask crops to 72dp).
 *
 * Proportions
 * -----------
 * The mark is placed at the same fraction of the canvas it occupies in the
 * source artwork (measured at runtime, never hard-coded) and centred on its
 * own bounding box, so the mark keeps its exact aspect ratio and visual weight
 * at every size. Non-square canvases (Windows wide tiles, splash screens)
 * scale the mark against the *shorter* edge so it never overflows.
 *
 * Why Android's adaptive foreground needs no extra padding: at the source
 * proportion the mark is ~61% of the tile, and an adaptive icon layer is
 * 108dp, so the mark lands at ~66dp across. Android guarantees a 66dp visible
 * circle inside the 72dp mask, so the mark already sits inside every standard
 * mask (circle, squircle, rounded square) without being shrunk.
 *
 * Platform rules honoured here
 * ----------------------------
 * - iOS: opaque, no alpha channel, no pre-rounded corners (Apple rejects both).
 * - Google Play 512: full-bleed square, 32-bit, no transparency.
 * - Android adaptive foreground: real transparency (it is a layer, not an icon).
 * - Windows unplated alt-forms: kept on the tan field so the white mark stays
 *   visible on both light and dark surfaces.
 *
 * Usage (after replacing the logo):
 *     npm run generate-appstore-icons
 */

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "app-icon.png");
const OUT_DIR = path.join(ROOT, "public", "appstore-images");

/**
 * The logo's tan, sampled from the source artwork (not invented) so the
 * generated background is exactly the brand colour.
 */
const BRAND_TAN = [190, 147, 102]; // #BE9366
const BRAND_WHITE = [255, 255, 255];

/**
 * Where the mark starts and the flat tan background ends.
 *
 * The source artwork is two flat colours, so its alpha histogram (pixel
 * projected onto the tan -> white axis) is strongly bimodal: the tan's
 * compression noise tops out at 0.031 and the artwork starts at 0.063. A single
 * cutoff between the two therefore separates artwork from background exactly,
 * and the same value is used for flood-fill connectivity and for the alpha
 * ramp so there is no unseeded gap at the artwork's anti-aliased edge.
 */
const ALPHA_CUTOFF = 0.05;

/** Lossless PNG output. */
const PNG = { compressionLevel: 9, adaptiveFiltering: true, palette: false };

/* ------------------------------------------------------------------ *
 * Artwork analysis
 * ------------------------------------------------------------------ */

/**
 * Reads the source logo and returns the white mark as a cropped, transparent
 * PNG plus the geometry needed to place it.
 *
 * @returns {Promise<{mark: Buffer, ratioW: number, ratioH: number,
 *   sourceSize: number, markW: number, markH: number}>}
 */
async function readArtwork() {
  const { data, info } = await sharp(SOURCE)
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // 1. Alpha = position along the tan -> white axis. Exact for a two-colour
  //    artwork: compositing this white mark back over the tan background
  //    reproduces the original pixel value.
  const v = [
    BRAND_WHITE[0] - BRAND_TAN[0],
    BRAND_WHITE[1] - BRAND_TAN[1],
    BRAND_WHITE[2] - BRAND_TAN[2],
  ];
  const vLenSq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];

  const total = width * height;
  const alpha = new Float32Array(total);
  const isArt = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * channels;
    let a =
      ((data[p] - BRAND_TAN[0]) * v[0] +
        (data[p + 1] - BRAND_TAN[1]) * v[1] +
        (data[p + 2] - BRAND_TAN[2]) * v[2]) /
      vLenSq;
    if (a < 0) a = 0;
    else if (a > 1) a = 1;
    alpha[i] = a;
    isArt[i] = a > ALPHA_CUTOFF ? 1 : 0;
  }

  // 2. Flood-fill the art that touches the border. The tile is a rounded
  //    square, so the white outside its corners is connected to the image edge
  //    while the mark is fully enclosed by flat tan. That separates the mark
  //    from the tile's corner treatment without guessing the corner radius.
  //
  //    Connectivity uses the SAME cutoff as the alpha, which is what makes this
  //    exact. Flood-filling a stricter "is it white" test instead leaves a gap:
  //    the anti-aliased arc where the rounded corner blends into the tan is not
  //    bright enough to be seeded, yet still reads as art, so the chain breaks
  //    just short of the tile edge and a faint fringe survives around all four
  //    corners — which would pin the mark's bounding box to the whole canvas.
  //    The source's alpha histogram is cleanly bimodal (flat tan tops out at
  //    0.031, the artwork starts at 0.063), so one shared cutoff separates them.
  const outside = new Uint8Array(total);
  const stack = [];
  for (let x = 0; x < width; x++) stack.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y++) stack.push(0, y, width - 1, y);
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const i = y * width + x;
    if (outside[i] || !isArt[i]) continue;
    outside[i] = 1;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  // 3. Emit the mark: white on transparency, with everything outside the tile's
  //    corners zeroed and the cutoff applied as a soft ramp so the artwork's
  //    anti-aliased edge stays smooth (and the tan's compression noise, which
  //    sits below the cutoff, cannot show up as a haze over the background).
  const span = 1 - ALPHA_CUTOFF;
  const rgba = Buffer.alloc(total * 4);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const raw = outside[i] ? 0 : alpha[i];
      const a = raw > ALPHA_CUTOFF ? (raw - ALPHA_CUTOFF) / span : 0;
      const o = i * 4;
      rgba[o] = BRAND_WHITE[0];
      rgba[o + 1] = BRAND_WHITE[1];
      rgba[o + 2] = BRAND_WHITE[2];
      rgba[o + 3] = Math.round(a * 255);
      if (a > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("no white mark found in the source artwork");

  // Guard: if the corner mask ever fails to separate the mark from the tile
  // (a new logo, a different corner radius), the bounding box silently pins to
  // the whole canvas and every icon becomes a full-bleed white square. Fail
  // loudly instead of writing wrong artwork.
  const markSpanW = (maxX - minX + 1) / width;
  const markSpanH = (maxY - minY + 1) / height;
  if (markSpanW > 0.9 || markSpanH > 0.9 || markSpanW < 0.05 || markSpanH < 0.05) {
    throw new Error(
      `mark bounding box looks wrong (${markSpanW.toFixed(3)} x ${markSpanH.toFixed(3)} of the ` +
        `${width}x${height} tile) — the corner mask did not separate the mark from the tile shape. ` +
        `Adjust ALPHA_CUTOFF for the new artwork.`
    );
  }

  const markW = maxX - minX + 1;
  const markH = maxY - minY + 1;
  const mark = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: markW, height: markH })
    .png()
    .toBuffer();

  return {
    mark,
    markW,
    markH,
    sourceSize: width,
    // Measured, not assumed: the fraction of the tile the mark occupies.
    ratioW: markW / width,
    ratioH: markH / height,
  };
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/** Flat tan fill. sharp needs explicit channels; `rgb()` strings are not accepted. */
const tan = () => ({ r: BRAND_TAN[0], g: BRAND_TAN[1], b: BRAND_TAN[2] });

/**
 * Renders one icon: the mark scaled to the source proportions and centred on a
 * flat tan field.
 *
 * @param {Buffer} mark   cropped transparent mark from `readArtwork()`
 * @param {object} art    the measurements from `readArtwork()`
 * @param {number} width  canvas width in px
 * @param {number} height canvas height in px
 * @param {object} [opts]
 * @param {boolean} [opts.transparent] omit the tan field (adaptive foreground)
 * @param {boolean} [opts.alpha]       keep an alpha channel (Android / Play)
 * @param {number}  [opts.scale]       multiplier on the mark size
 */
async function render(mark, art, width, height, opts = {}) {
  const { transparent = false, alpha = false, scale = 1 } = opts;

  // Scale the mark against the shorter edge so wide canvases stay balanced.
  const base = Math.min(width, height);
  const markH = Math.max(1, Math.round(base * art.ratioH * scale));
  const markW = Math.max(1, Math.round(base * art.ratioW * scale));

  const markPng = await sharp(mark)
    .resize(markW, markH, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer();

  // The base canvas *is* the tan fill for an opaque icon, so no extra layer is
  // needed for it. Channel count matters: App Store Connect rejects an App Icon
  // that carries an alpha channel even when it is fully opaque, and sharp only
  // really drops the channel when the canvas was created as 3-channel — with a
  // 4-channel base, neither `removeAlpha()` nor `flatten()` takes it back out of
  // the encoded PNG. So the opaque path creates RGB and strips; only the
  // adaptive foreground (which is a layer, not an icon) keeps 4 channels.
  const canvas = transparent
    ? sharp({ create: { width, height, channels: 4, background: { ...tan(), alpha: 0 } } })
    : sharp({ create: { width, height, channels: 3, background: tan() } });

  let pipe = canvas.composite([
    {
      input: markPng,
      top: Math.round((height - markH) / 2),
      left: Math.round((width - markW) / 2),
    },
  ]);
  if (!alpha) pipe = pipe.removeAlpha();
  return pipe.png(PNG).toBuffer();
}

/** A completely flat tan square — the Android adaptive background layer. */
function renderSolid(width, height, alpha) {
  const pipe = alpha
    ? sharp({ create: { width, height, channels: 4, background: tan() } })
    : sharp({ create: { width, height, channels: 3, background: tan() } });
  return pipe.png(PNG).toBuffer();
}

/* ------------------------------------------------------------------ *
 * Platform size tables
 * ------------------------------------------------------------------ */

/**
 * Android launcher icons.
 *
 * `legacy` is the pre-Oreo square icon in dp (48dp * density).
 * `adaptive` is the 108dp adaptive-icon layer (108dp * density) — the
 * foreground is the mark on transparency, the background is a flat tan layer.
 * Round variants are separate resources in every Android project.
 */
const ANDROID_DENSITIES = [
  { name: "mdpi", scale: 1 },
  { name: "hdpi", scale: 1.5 },
  { name: "xhdpi", scale: 2 },
  { name: "xxhdpi", scale: 3 },
  { name: "xxxhdpi", scale: 4 },
];
const ANDROID_LEGACY_DP = 48;
const ANDROID_ADAPTIVE_DP = 108;
/** Google Play listing icon — fixed by the Play Console, not by density. */
const PLAY_STORE_SIZE = 512;

/**
 * iOS App Icon set.
 *
 * The filename carries the @1x/@2x/@3x variant Xcode expects, and `px` is the
 * exact pixel size that variant must have. The 1024px marketing icon is 1x.
 */
const IOS_ICONS = [
  { name: "AppIcon-20@1x", px: 20 },
  { name: "AppIcon-20@2x", px: 40 },
  { name: "AppIcon-20@3x", px: 60 },
  { name: "AppIcon-29@1x", px: 29 },
  { name: "AppIcon-29@2x", px: 58 },
  { name: "AppIcon-29@3x", px: 87 },
  { name: "AppIcon-40@1x", px: 40 },
  { name: "AppIcon-40@2x", px: 80 },
  { name: "AppIcon-40@3x", px: 120 },
  { name: "AppIcon-60@2x", px: 120 },
  { name: "AppIcon-60@3x", px: 180 },
  { name: "AppIcon-76@1x", px: 76 },
  { name: "AppIcon-76@2x", px: 152 },
  { name: "AppIcon-83.5@2x", px: 167 },
  { name: "AppIcon-1024", px: 1024 },
];

/**
 * Flat pixel sizes kept alongside the Xcode-style names so the folder also
 * satisfies older tooling and any existing `href` that points at `NN.png`.
 * The union of the iPhone/iPad 1x/2x/3x slots plus the sizes a web app asks for.

 */
const IOS_LEGACY_SIZES = [
  16, 20, 29, 32, 40, 50, 57, 58, 60, 64, 72, 76, 80, 87, 100, 114, 120, 128, 144, 152, 167,
  180, 192, 256, 512, 1024,
];


/**
 * Windows (UWP/MSIX) tile assets.
 *
 * `scale-NNN` are scale-qualified resources (NNN = 100/125/150/200/400).
 * `targetsize-NN` are alt-form assets for taskbar / jump-list target sizes.
 * Pixel dimensions are spelled out rather than computed so they reproduce the
 * sizes Windows expects (it truncates, it does not round: 150 * 1.25 -> 187).
 */
const WINDOWS_ASSETS = [
  // Large tile (Start screen, wide square)
  { name: "LargeTile.scale-100", w: 310, h: 310 },
  { name: "LargeTile.scale-125", w: 387, h: 387 },
  { name: "LargeTile.scale-150", w: 465, h: 465 },
  { name: "LargeTile.scale-200", w: 620, h: 620 },
  { name: "LargeTile.scale-400", w: 1240, h: 1240 },
  // Small tile
  { name: "SmallTile.scale-100", w: 71, h: 71 },
  { name: "SmallTile.scale-125", w: 88, h: 88 },
  { name: "SmallTile.scale-150", w: 106, h: 106 },
  { name: "SmallTile.scale-200", w: 142, h: 142 },
  { name: "SmallTile.scale-400", w: 284, h: 284 },
  // Medium tile
  { name: "Square150x150Logo.scale-100", w: 150, h: 150 },
  { name: "Square150x150Logo.scale-125", w: 187, h: 187 },
  { name: "Square150x150Logo.scale-150", w: 225, h: 225 },
  { name: "Square150x150Logo.scale-200", w: 300, h: 300 },
  { name: "Square150x150Logo.scale-400", w: 600, h: 600 },
  // App list / taskbar
  { name: "Square44x44Logo.scale-100", w: 44, h: 44 },
  { name: "Square44x44Logo.scale-125", w: 55, h: 55 },
  { name: "Square44x44Logo.scale-150", w: 66, h: 66 },
  { name: "Square44x44Logo.scale-200", w: 88, h: 88 },
  { name: "Square44x44Logo.scale-400", w: 176, h: 176 },
  { name: "StoreLogo.scale-100", w: 50, h: 50 },
  { name: "StoreLogo.scale-125", w: 62, h: 62 },
  { name: "StoreLogo.scale-150", w: 75, h: 75 },
  { name: "StoreLogo.scale-200", w: 100, h: 100 },
  { name: "StoreLogo.scale-400", w: 200, h: 200 },
  // Wide tile and splash screen
  { name: "Wide310x150Logo.scale-100", w: 310, h: 150 },
  { name: "Wide310x150Logo.scale-125", w: 387, h: 187 },
  { name: "Wide310x150Logo.scale-150", w: 465, h: 225 },
  { name: "Wide310x150Logo.scale-200", w: 620, h: 300 },
  { name: "Wide310x150Logo.scale-400", w: 1240, h: 600 },
  { name: "SplashScreen.scale-100", w: 620, h: 300 },
  { name: "SplashScreen.scale-125", w: 775, h: 375 },
  { name: "SplashScreen.scale-150", w: 930, h: 450 },
  { name: "SplashScreen.scale-200", w: 1240, h: 600 },
  { name: "SplashScreen.scale-400", w: 2480, h: 1200 },
];

/** Windows taskbar / jump-list alt-forms: same artwork, explicit target sizes. */
const WINDOWS_TARGET_SIZES = [16, 20, 24, 30, 32, 36, 40, 44, 48, 60, 64, 72, 80, 96, 256];
const WINDOWS_ALT_FORMS = [
  "Square44x44Logo.targetsize",
  "Square44x44Logo.altform-unplated_targetsize",
  "Square44x44Logo.altform-lightunplated_targetsize",
];

/** The `launchericon-*` names the previous PWA asset tool produced, kept so existing references keep resolving. */
const ANDROID_LEGACY_COMPAT_SIZES = [48, 72, 96, 144, 192, 512];

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

/** @type {{dir: string, file: string, w: number, h: number}[]} every file written, for verification */
const written = [];

async function write(dir, file, buffer, w, h) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, file), buffer);
  written.push({ dir, file, w, h });
}

async function generateAndroid(art) {
  const dir = path.join(OUT_DIR, "android");
  for (const { name, scale } of ANDROID_DENSITIES) {
    const legacy = Math.round(ANDROID_LEGACY_DP * scale);
    const square = await render(art.mark, art, legacy, legacy, { alpha: true });
    await write(dir, `ic_launcher-${name}.png`, square, legacy, legacy);
    await write(dir, `ic_launcher_round-${name}.png`, square, legacy, legacy);

    const adaptive = Math.round(ANDROID_ADAPTIVE_DP * scale);
    // Foreground is a layer: the mark only, on real transparency, sized to sit
    // inside the 66dp safe circle. Background is a flat tan layer behind it.
    const foreground = await render(art.mark, art, adaptive, adaptive, {
      transparent: true,
      alpha: true,
    });
    await write(dir, `ic_launcher_foreground-${name}.png`, foreground, adaptive, adaptive);
    await write(dir, `ic_launcher_foreground_round-${name}.png`, foreground, adaptive, adaptive);
    const background = await renderSolid(adaptive, adaptive, true);
    await write(dir, `ic_launcher_background-${name}.png`, background, adaptive, adaptive);
    await write(dir, `ic_launcher_background_round-${name}.png`, background, adaptive, adaptive);
  }

  await write(
    dir,
    `ic_launcher-playstore-${PLAY_STORE_SIZE}.png`,
    await render(art.mark, art, PLAY_STORE_SIZE, PLAY_STORE_SIZE, { alpha: true }),
    PLAY_STORE_SIZE,
    PLAY_STORE_SIZE
  );

  for (const size of ANDROID_LEGACY_COMPAT_SIZES) {
    await write(
      dir,
      `launchericon-${size}x${size}.png`,
      await render(art.mark, art, size, size, { alpha: true }),
      size,
      size
    );
  }
}

async function generateIos(art) {
  const dir = path.join(OUT_DIR, "ios");
  for (const { name, px } of IOS_ICONS) {
    // Apple rejects an alpha channel and pre-rounded corners on App Icons.
    await write(dir, `${name}.png`, await render(art.mark, art, px, px), px, px);
  }
  for (const px of IOS_LEGACY_SIZES) {
    await write(dir, `${px}.png`, await render(art.mark, art, px, px), px, px);
  }
}

async function generateWindows(art) {
  const dir = path.join(OUT_DIR, "windows");
  for (const { name, w, h } of WINDOWS_ASSETS) {
    await write(dir, `${name}.png`, await render(art.mark, art, w, h), w, h);
  }
  for (const prefix of WINDOWS_ALT_FORMS) {
    for (const size of WINDOWS_TARGET_SIZES) {
      await write(
        dir,
        `${prefix}-${size}.png`,
        await render(art.mark, art, size, size),
        size,
        size
      );
    }
  }
}

/**
 * Re-reads every file just written and checks it against what was requested:
 * exact pixel dimensions, the right transparency contract, and a tan/white
 * palette only (no leftover blue). Writes nothing; returns the problems found.
 */
async function verify() {
  const problems = [];
  for (const { dir, file, w, h } of written) {
    const p = path.join(dir, file);
    const meta = await sharp(p).metadata();
    if (meta.width !== w || meta.height !== h) {
      problems.push(`${file}: expected ${w}x${h}, got ${meta.width}x${meta.height}`);
    }

    const { data, info } = await sharp(p)
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px = info.width * info.height;
    let blue = 0, clear = 0;
    for (let i = 0; i < px; i++) {
      const o = i * info.channels;
      if (data[o + 2] > data[o] + 12 && data[o + 2] > 60) blue++;
      if (data[o + 3] === 0) clear++;
    }

    // Transparency contract.
    //  - iOS: App Store Connect REJECTS an App Icon that carries an alpha
    //    channel, even a fully opaque one, so these must be flat RGB.
    //  - Android/Google Play: a 32-bit alpha channel is expected (Play masks the
    //    512 icon itself), and the adaptive foreground must be see-through.
    //  - Windows: alpha is tolerated; the tiles are written flat anyway so the
    //    artwork composites predictably over any taskbar surface.
    if (file.includes("ic_launcher_foreground")) {
      if (clear / px < 0.5) {
        problems.push(
          `${file}: adaptive foreground is only ${((clear / px) * 100).toFixed(0)}% transparent`
        );
      }
    } else if (path.basename(dir) === "ios" && meta.hasAlpha) {
      problems.push(`${file}: iOS App Icons must not carry an alpha channel`);
    } else if (clear > 0) {
      problems.push(`${file}: expected an opaque icon, found ${clear} transparent pixel(s)`);
    }
    if (blue > 0) problems.push(`${file}: ${blue} blue-ish pixel(s)`);
  }
  return problems;
}

async function main() {
  const art = await readArtwork();
  const hex = `#${BRAND_TAN.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  console.log(
    `source     ${path.relative(ROOT, SOURCE)} ${art.sourceSize}x${art.sourceSize} · tan rgb(${BRAND_TAN.join(",")}) ${hex}`
  );
  console.log(
    `mark       ${art.markW}x${art.markH} · ${(art.ratioW * 100).toFixed(2)}% x ${(art.ratioH * 100).toFixed(2)}% of the tile`
  );

  await generateAndroid(art);
  await generateIos(art);
  await generateWindows(art);

  const problems = await verify();
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`\nwrote + verified ${written.length} files in public/appstore-images/`);
}

/* Only run when invoked directly — `generate-pwa-icons.js` imports the
 * artwork analysis + renderer above so the PWA set and the app-store set can
 * never drift apart. */
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { readArtwork, render, SOURCE, BRAND_TAN, BRAND_WHITE };
