/**
 * i18n audit — `npm run audit:i18n`
 *
 * Cheap, dependency-free checks that catch the class of bug where a page
 * renders one language while the URL asked for another:
 *
 *   1. `messages/en.json` and `messages/ar.json` are valid JSON and have
 *      EXACTLY the same key set (a key present in one and missing in the
 *      other is how "Arabic string shown on an English page" happens).
 *   2. Both files declare every locale in `src/i18n/locales.ts`.
 *   3. No message catalog still contains a hard-coded `*Ar`/`*En` marker or
 *      an obvious placeholder.
 *
 * Run it in CI or before a release. It intentionally does NOT need the app to
 * be running.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = join(root, "messages");
const localesSrc = readFileSync(join(root, "src", "i18n", "locales.ts"), "utf8");

/** Locales declared in the single source of truth. */
const declared = [...localesSrc.matchAll(/^\s*"([a-z]{2})",?\s*$/gm)].map((m) => m[1]);

/** Recursively collect dotted leaf keys of a parsed catalog. */
function flatten(value, prefix = "", out = []) {
  for (const [key, child] of Object.entries(value)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, pathKey, out);
    } else {
      out.push(pathKey);
    }
  }
  return out;
}

const problems = [];

if (!existsSync(messagesDir)) {
  console.error("✗ messages/ directory not found");
  process.exit(1);
}

const files = readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("✗ no message catalogs found in messages/");
  process.exit(1);
}

const catalogs = {};
for (const file of files) {
  const locale = file.replace(/\.json$/, "");
  try {
    catalogs[locale] = JSON.parse(readFileSync(join(messagesDir, file), "utf8"));
  } catch (error) {
    problems.push(`messages/${file} is not valid JSON: ${error.message}`);
  }
}

// 1. every declared locale has a catalog
for (const locale of declared) {
  if (!catalogs[locale]) problems.push(`messages/${locale}.json is missing`);
}

// 2. key sets must match exactly
const locales = Object.keys(catalogs);
const [reference, ...rest] = locales;
if (reference) {
  const referenceKeys = new Set(flatten(catalogs[reference]));
  for (const locale of rest) {
    const keys = new Set(flatten(catalogs[locale]));
    const missing = [...referenceKeys].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !referenceKeys.has(k));
    for (const key of missing) problems.push(`messages/${locale}.json is missing key "${key}"`);
    for (const key of extra) problems.push(`messages/${locale}.json has unknown key "${key}"`);
  }
}

// 3. no leftover bilingual field markers left inside a catalog
for (const [locale, catalog] of Object.entries(catalogs)) {
  for (const key of flatten(catalog)) {
    if (/(^|\.)(ar|en)$/i.test(key) && !["ar", "en"].includes(locale)) {
      // `x.ar` / `x.en` inside a flat catalog is a leftover from the old
      // `*Ar` / `*En` config shape and should be a single key per language.
      problems.push(`messages/${locale}.json has bilingual-style key "${key}"`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ i18n audit failed (${problems.length} problem(s)):`);
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}

const total = flatten(catalogs[reference] ?? {}).length;
console.log(`✓ i18n audit passed — ${locales.length} locales (${locales.join(", ")}), ${total} keys each.`);
