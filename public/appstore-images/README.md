# App-store / platform icon assets

Generated — do not hand-edit.

```bash
npm run generate-appstore-icons   # regenerates everything in this folder
```

**Source of truth:** [`/app-icon.png`](../app-icon.png) — the new Youth For
Christ logo (1254×1254): a warm tan field with the white simplified YFC + cross
mark. No Arabic text, no English text, no gradient, no shadow.

The generator never redraws, recolours, restyles or re-lays-out the artwork. It
derives an exact alpha mask for the white mark (by projecting each pixel onto
the tan→white colour axis, which reproduces the anti-aliased edges
mathematically), discards the rounded-corner region, and places the mark on a
flat `#BE9366` field at the same proportion and the same aspect ratio it
occupies in the source. Every file here is a **downscale** of that one 1254px
file — nothing is upscaled from a thumbnail, and no JPEG artifacts are
introduced (all output is lossless PNG).

Measured on the current source: the mark is 721×767 px = **57.50% × 61.16%** of
the tile, centred on its own bounding box. Those numbers are re-measured at
build time, not hard-coded.

## Colour + transparency rules applied

| Rule | Why |
|---|---|
| Flat `#BE9366` field, no gradient | Brand colour, sampled from the source artwork |
| No alpha channel on anything in `ios/` | App Store Connect **rejects** App Icons with an alpha channel, even a fully opaque one |
| Alpha **only** on `ic_launcher_foreground*` | It is an adaptive-icon *layer*, not an icon; it must composite over the background layer |
| No pre-rounded corners | Every platform applies its own mask (iOS squircle, Play circle, Android mask) |
| 32-bit PNG for Android + Play | Play requires a 32-bit listing icon and masks it itself |

## Layout

```
public/appstore-images/
├── README.md
├── android/    launcher + adaptive-icon assets, and the Play listing icon
├── ios/        App Icon set (Xcode names) + flat size-named copies
└── windows/    UWP/MSIX tiles, taskbar logos, store logo, splash screens
```

## `android/` — launcher + adaptive icons

Naming follows Android Studio / the `mipmap` resource convention: the density
is the filename suffix. Copy each file into
`app/src/main/res/mipmap-<density>/` keeping the base name.

| File | Size | Purpose |
|---|---|---|
| `ic_launcher-mdpi.png` | 48×48 | legacy square launcher icon (mdpi, 48dp) |
| `ic_launcher-hdpi.png` | 72×72 | legacy square launcher icon (hdpi) |
| `ic_launcher-xhdpi.png` | 96×96 | legacy square launcher icon (xhdpi) |
| `ic_launcher-xxhdpi.png` | 144×144 | legacy square launcher icon (xxhdpi) |
| `ic_launcher-xxxhdpi.png` | 192×192 | legacy square launcher icon (xxxhdpi) |
| `ic_launcher_round-<density>.png` | 48 / 72 / 96 / 144 / 192 | round launcher icon variant |
| `ic_launcher_foreground-<density>.png` | 108 / 162 / 216 / 324 / 432 | **adaptive** foreground layer (mark on transparency) |
| `ic_launcher_foreground_round-<density>.png` | 108 / 162 / 216 / 324 / 432 | adaptive foreground, round mask |
| `ic_launcher_background-<density>.png` | 108 / 162 / 216 / 324 / 432 | adaptive background layer (flat tan) |
| `ic_launcher_background_round-<density>.png` | 108 / 162 / 216 / 324 / 432 | adaptive background, round mask |
| `ic_launcher-playstore-512.png` | 512×512 | Google Play Console listing icon (32-bit) |
| `launchericon-<n>x<n>.png` | 48 / 72 / 96 / 144 / 192 / 512 | legacy web/PWA naming, kept so older references still resolve |

The adaptive layer sizes are 108dp × density, and the foreground/background
pairs must be swapped in together — the foreground is see-through on purpose.

**Safe padding.** Android crops an adaptive icon to a 72dp square inside the
108dp layer, and only guarantees the inner 66dp circle. The mark already
occupies 61.16% of the tile, i.e. ≈66dp of a 108dp layer, so it lands inside
every standard mask (circle, squircle, rounded square) with room to spare — no
extra padding is applied, because padding would only shrink an already-safe
mark. This was verified by compositing the real foreground over the real
background and masking with all three shapes.


## `ios/` — App Icon set

Two equivalent sets live side by side:

- **`AppIcon-<pt>@<scale>x.png`** — the Xcode `AppIcon.appiconset` naming, with
  the `@1x` / `@2x` / `@3x` variant in the filename.
- **`<n>.png`** — the same pixel sizes under flat names, so an existing
  `href="/appstore-images/ios/180.png"` keeps working.

| Xcode name | Size | Slot |
|---|---|---|
| `AppIcon-20@1x` / `@2x` / `@3x` | 20 / 40 / 60 | iPhone + iPad notification |
| `AppIcon-29@1x` / `@2x` / `@3x` | 29 / 58 / 87 | iPhone + iPad settings |
| `AppIcon-40@1x` / `@2x` / `@3x` | 40 / 80 / 120 | iPhone + iPad spotlight |
| `AppIcon-60@2x` / `@3x` | 120 / 180 | iPhone notification |
| `AppIcon-76@1x` / `@2x` | 76 / 152 | iPad |
| `AppIcon-83.5@2x` | 167 | iPad Pro 13" |
| `AppIcon-1024` | 1024 | App Store marketing icon |

Flat-name sizes: 16, 20, 29, 32, 40, 50, 57, 58, 60, 64, 72, 76, 80, 87, 100,
114, 120, 128, 144, 152, 167, 180, 192, 256, 512, 1024.

All of them are flat RGB — **no alpha channel and no pre-rounded corners**,
which App Store Connect requires. The 1024px marketing icon is the file to
upload.

## `windows/` — UWP/MSIX tiles

Scale-qualified resources (`scale-NNN`) and target-size alt-forms
(`targetsize-NN`), using Microsoft's own naming.

| File | Size | Used by |
|---|---|---|
| `LargeTile.scale-100/125/150/200/400` | 310, 387, 465, 620, 1240 (square) | Start screen, large tile |
| `SmallTile.scale-100/125/150/200/400` | 71, 88, 106, 142, 284 | Start screen, small tile |
| `Square150x150Logo.scale-100/125/150/200/400` | 150, 187, 225, 300, 600 | Start screen, medium tile |
| `Square44x44Logo.scale-100/125/150/200/400` | 44, 55, 66, 88, 176 | taskbar, app list |
| `Square44x44Logo.targetsize-<n>` | 16, 20, 24, 30, 32, 36, 40, 44, 48, 60, 64, 72, 80, 96, 256 | taskbar / jump list |
| `Square44x44Logo.altform-unplated_targetsize-<n>` | same 15 sizes | unplated taskbar variant |
| `Square44x44Logo.altform-lightunplated_targetsize-<n>` | same 15 sizes | light-unplated taskbar variant |
| `StoreLogo.scale-100/125/150/200/400` | 50, 62, 75, 100, 200 | Store listing |
| `Wide310x150Logo.scale-100/125/150/200/400` | 310×150, 387×187, 465×225, 620×300, 1240×600 | Start screen, wide tile |
| `SplashScreen.scale-100/125/150/200/400` | 620×300, 775×375, 930×450, 1240×600, 2480×1200 | app splash |

The `targetsize` and `altform` variants are generated with the same tan field
rather than a transparent background, so the white mark stays legible on both
light and dark surfaces.

Non-square canvases scale the mark against the **shorter** edge, so the wide
tile and the splash screen stay optically balanced instead of overflowing.


## Platform configuration still to be added

The assets are ready; the wiring lives in each native project / store console.

### Android — `mipmap-anydpi-v26/ic_launcher.xml`

Copy the files into `app/src/main/res/mipmap-<density>/` (density = filename
suffix), then add the adaptive-icon declaration:

```xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
```

`monochrome` reuses the foreground as a themed icon; it is a solid white mark
on transparency, which is exactly what the Android 13+ themed-icon spec wants.
Add `<monochrome>` to `ic_launcher_round.xml` as well.

Then declare the round icon in `AndroidManifest.xml`:

```xml
<application android:roundIcon="@mipmap/ic_launcher_round" ...>
```

### iOS — `Assets.xcassets`

Create an App Icon set and point each slot at the matching
`AppIcon-<pt>@<scale>x.png` in this folder, or drag the whole set in. Upload
`AppIcon-1024.png` to App Store Connect. Do not add an alpha channel or round
the corners yourself.

For the installed PWA (home screen + splash), `src/app/[locale]/layout.tsx`
already points `apple-touch-icon` at the generated
`/icons/apple-touch-icon-180x180.png` and the web manifest at
`/icons/icon-192x192.png` + `/icons/icon-512x512.png`, all regenerated by
`npm run generate-icons` from the same source logo.

> The `apple-touch-startup-image` links in that file still point at the Windows
> `SplashScreen.scale-*` art, which is a 620×300 landscape tile stretched into a
> portrait device. Those links need real iOS startup images
> (e.g. 1290×2796, 1179×2556, 1284×2778, 1170×2532, 1125×2436, 828×1792,
> 750×1334) before the PWA is submitted to the App Store.

### Windows — `Package.appxmanifest`

Reference the tile assets in the manifest, e.g.:

```xml
<uap:VisualElements
    BackgroundColor="#BE9366"
    Square150x150Logo="Assets\Square150x150Logo.scale-200.png"
    Square44x44Logo="Assets\Square44x44Logo.scale-200.png"
    Wide310x150Logo="Assets\Wide310x150Logo.scale-200.png"
    Square310x310Logo="Assets\LargeTile.scale-200.png"
    Description="Youth For Christ Meeting" />
```

`BackgroundColor` is the brand tan, so the unplated taskbar variants sit on a
matching surface.

### Google Play

Upload `ic_launcher-playstore-512.png` as the listing icon, and the
`ic_launcher_playstore` / feature-graphic slots separately (Play's feature
graphic is 1024×500 and is **not** generated here — it needs the tan field with
the mark composed at that aspect ratio).

## Re-generating after a logo change

1. Replace `public/app-icon.png` with the new artwork (square, high-res).
2. `npm run generate-appstore-icons` — rewrites all three folders and verifies
   every file's dimensions, the transparency contract, and the palette.
3. `npm run generate-icons` — rewrites `public/icons/` from the same source.

Both scripts measure the new artwork at run time, so nothing needs editing when
the mark moves or is rescaled. The generator fails loudly (rather than writing
wrong artwork) if the mark cannot be separated from the background.

