const fs = require("node:fs");
const path = require("node:path");
const sharp = require(path.join(__dirname, "..", "node_modules", "sharp"));
const ROOT = path.join(__dirname, "..");
const BASE = path.join(ROOT, "public", "appstore-images");
const TAN = [190, 147, 102];
const lines = [];
const log = (...a) => lines.push(a.join(" "));

// expected pixel size for every generated file
const EXPECT = {};
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, s] of Object.entries(densities)) {
  const leg = Math.round(48 * s), ad = Math.round(108 * s);
  EXPECT[`android/ic_launcher-${d}.png`] = [leg, leg];
  EXPECT[`android/ic_launcher_round-${d}.png`] = [leg, leg];
  EXPECT[`android/ic_launcher_foreground-${d}.png`] = [ad, ad];
  EXPECT[`android/ic_launcher_foreground_round-${d}.png`] = [ad, ad];
  EXPECT[`android/ic_launcher_background-${d}.png`] = [ad, ad];
  EXPECT[`android/ic_launcher_background_round-${d}.png`] = [ad, ad];
}
EXPECT["android/ic_launcher-playstore-512.png"] = [512, 512];
for (const n of [48, 72, 96, 144, 192, 512]) EXPECT[`android/launchericon-${n}x${n}.png`] = [n, n];

const iosPt = { "AppIcon-20@1x": 20, "AppIcon-20@2x": 40, "AppIcon-20@3x": 60, "AppIcon-29@1x": 29,
  "AppIcon-29@2x": 58, "AppIcon-29@3x": 87, "AppIcon-40@1x": 40, "AppIcon-40@2x": 80,
  "AppIcon-40@3x": 120, "AppIcon-60@2x": 120, "AppIcon-60@3x": 180, "AppIcon-76@1x": 76,
  "AppIcon-76@2x": 152, "AppIcon-83.5@2x": 167 };
for (const [k, v] of Object.entries(iosPt)) EXPECT[`ios/${k}.png`] = [v, v];
EXPECT["ios/AppIcon-1024.png"] = [1024, 1024];
for (const n of [16,20,29,32,40,50,57,58,60,64,72,76,80,87,100,114,120,128,144,152,167,180,192,256,512,1024])
  EXPECT[`ios/${n}.png`] = [n, n];

const win = {
  "LargeTile.scale-100":[310,310],"LargeTile.scale-125":[387,387],"LargeTile.scale-150":[465,465],
  "LargeTile.scale-200":[620,620],"LargeTile.scale-400":[1240,1240],
  "SmallTile.scale-100":[71,71],"SmallTile.scale-125":[88,88],"SmallTile.scale-150":[106,106],
  "SmallTile.scale-200":[142,142],"SmallTile.scale-400":[284,284],
  "Square150x150Logo.scale-100":[150,150],"Square150x150Logo.scale-125":[187,187],
  "Square150x150Logo.scale-150":[225,225],"Square150x150Logo.scale-200":[300,300],
  "Square150x150Logo.scale-400":[600,600],
  "Square44x44Logo.scale-100":[44,44],"Square44x44Logo.scale-125":[55,55],
  "Square44x44Logo.scale-150":[66,66],"Square44x44Logo.scale-200":[88,88],
  "Square44x44Logo.scale-400":[176,176],
  "StoreLogo.scale-100":[50,50],"StoreLogo.scale-125":[62,62],"StoreLogo.scale-150":[75,75],
  "StoreLogo.scale-200":[100,100],"StoreLogo.scale-400":[200,200],
  "Wide310x150Logo.scale-100":[310,150],"Wide310x150Logo.scale-125":[387,187],
  "Wide310x150Logo.scale-150":[465,225],"Wide310x150Logo.scale-200":[620,300],
  "Wide310x150Logo.scale-400":[1240,600],
  "SplashScreen.scale-100":[620,300],"SplashScreen.scale-125":[775,375],
  "SplashScreen.scale-150":[930,450],"SplashScreen.scale-200":[1240,600],
  "SplashScreen.scale-400":[2480,1200],
};
for (const [k,v] of Object.entries(win)) EXPECT[`windows/${k}.png`] = v;
for (const pre of ["Square44x44Logo.targetsize","Square44x44Logo.altform-unplated_targetsize","Square44x44Logo.altform-lightunplated_targetsize"])
  for (const n of [16,20,24,30,32,36,40,44,48,60,64,72,80,96,256]) EXPECT[`windows/${pre}-${n}.png`] = [n,n];

(async () => {
  const problems = [];
  let checked = 0, total = 0;

  for (const plat of ["android", "ios", "windows"]) {
    const dir = path.join(BASE, plat);
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".png")).sort()) {
      total++;
      const rel = `${plat}/${f}`;
      const p = path.join(dir, f);
      const meta = await sharp(p).metadata();
      const exp = EXPECT[rel];
      if (!exp) { problems.push(`${rel}: UNEXPECTED FILE`); continue; }
      checked++;
      if (meta.width !== exp[0] || meta.height !== exp[1])
        problems.push(`${rel}: expected ${exp[0]}x${exp[1]}, got ${meta.width}x${meta.height}`);

      const { data, info } = await sharp(p).toColourspace("srgb").ensureAlpha().raw()
        .toBuffer({ resolveWithObject: true });
      const px = info.width * info.height;
      // The artwork is exactly two flat colours, so every legitimate pixel —
      // including every anti-aliased edge — must lie on the tan -> white axis.
      // Anything with a component perpendicular to that axis is a colour the
      // generator introduced, and would mean the artwork was altered.
      const V = [255 - TAN[0], 255 - TAN[1], 255 - TAN[2]];
      const L2 = V[0] * V[0] + V[1] * V[1] + V[2] * V[2];
      let blue = 0, clear = 0, tanPx = 0, whitePx = 0, offAxis = 0;
      for (let i = 0; i < px; i++) {
        const o = i * info.channels, r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
        if (b > r + 12 && b > 60) blue++;
        if (a === 0) { clear++; continue; }
        const d = Math.hypot(r - TAN[0], g - TAN[1], b - TAN[2]);
        if (d < 8) tanPx++;
        else if (r > 225 && g > 225 && b > 225) whitePx++;
        const t = ((r - TAN[0]) * V[0] + (g - TAN[1]) * V[1] + (b - TAN[2]) * V[2]) / L2;
        const cx = TAN[0] + t * V[0], cy = TAN[1] + t * V[1], cz = TAN[2] + t * V[2];
        if (Math.hypot(r - cx, g - cy, b - cz) > 6) offAxis++;
      }
      if (blue) problems.push(`${rel}: ${blue} blue pixel(s)`);
      if (offAxis) problems.push(`${rel}: ${offAxis} pixel(s) off the tan->white colour axis`);
      if (f.includes("ic_launcher_foreground")) {
        if (clear / px < 0.5) problems.push(`${rel}: foreground only ${(clear / px * 100).toFixed(0)}% transparent`);
      } else {
        if (clear) problems.push(`${rel}: ${clear} transparent pixel(s) in an opaque icon`);
        if (plat === "ios" && meta.hasAlpha) problems.push(`${rel}: iOS icon carries an alpha channel`);
        if (tanPx / px < 0.5) problems.push(`${rel}: less than half the canvas is the tan field`);
        if (whitePx < px * 0.004) problems.push(`${rel}: no visible white mark`);
      }
    }
  }
  log(`checked ${checked} files against the size table · ${total} PNGs on disk`);


  // Any brand/logo asset in public/ must no longer be the old blue artwork.
  // Servant photos and the unrelated Verse Up game logo are excluded: they are
  // not this brand's logo, so "blue" is legitimate in them.
  const BRAND = /^(logo|app-icon)\.(png|jpe?g)$|^icons\/|^appstore-images\//i;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );
  log("\n=== palette check: brand assets in public/ ===");
  for (const p of walk(path.join(ROOT, "public")).filter((f) => /\.(png|jpe?g)$/i.test(f))) {
    const rel = path.relative(path.join(ROOT, "public"), p).replace(/\\/g, "/");
    if (!BRAND.test(rel)) continue;
    const { data, info } = await sharp(p).ensureAlpha().removeAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    let blue = 0;
    const n = info.width * info.height;
    for (let i = 0; i < n; i++) {
      const o = i * info.channels;
      if (data[o + 2] > data[o] + 12 && data[o + 2] > 60) blue++;
    }
    const pct = (blue / n) * 100;
    log(`  ${pct.toFixed(1).padStart(5)}% blue  ${rel}${pct > 5 ? "   <-- STILL BLUE" : ""}`);
    if (pct > 5) problems.push(`${rel}: still ${pct.toFixed(1)}% blue`);
  }

  log(`\n${problems.length} problem(s)`);
  for (const p of problems) log(`  ! ${p}`);
  fs.writeFileSync(path.join(ROOT, "verify-report.txt"), lines.join("\n"));
  console.log(lines.join("\n"));
})();

