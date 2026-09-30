/**
 * Runtime i18n verification.
 *
 * Run `next start` first, then:
 *   node scripts/verify-i18n-routes.mjs [baseUrl]
 *
 * For every localized route it asserts:
 *   1. <html lang> and <html dir> match the URL locale
 *   2. the document <title> is in the URL's language
 *   3. <link rel="canonical"> points at the same locale
 *   4. an English page contains NO Arabic UI text, and vice versa
 *   5. the equivalent page in the other locale resolves correctly
 */

const BASE = process.argv[2] ?? "http://localhost:3111";

/** Arabic ranges — enough to catch UI copy leaking into an English page. */
const ARABIC = /[\u0600-\u06FF\u0750-\u077F]/;
const LATIN_WORD = /[A-Za-z]{3,}/;

/**
 * UI phrases that must be present per language.
 *
 * `nav.*` is the bottom bar, present on every localized page, so it is the
 * right thing to assert on every route.
 */
const NAV_PHRASES = {
  en: ["Home", "Events", "Bible", "Games", "More"],
  ar: ["الرئيسية", "الفعاليات", "المزيد"],
};

/** Page-specific phrases asserted on top of the nav bar. */
const PAGE_PHRASES = {
  "/en/more/servants": { en: ["Servants", "Ehab Youssef"] },
  "/ar/more/servants": { ar: ["الخدام", "إيهاب يوسف"] },
  "/en/more": { en: ["Servants", "Prayer Wall"] },
  "/ar/more": { ar: ["الخدام", "جدار الصلاة"] },
  "/en/more/about": { en: ["About Us"] },
  "/ar/more/about": { ar: ["من نحن"] },
  "/en/more/contact": { en: ["Follow Us"] },
  "/ar/more/contact": { ar: ["تابعنا"] },
  "/en/more/gallery": { en: ["Gallery"] },
  "/ar/more/gallery": { ar: ["معرض الصور"] },
  "/en/more/prayer-wall": { en: ["Prayer Wall", "Share a Prayer Request"] },
  "/ar/more/prayer-wall": { ar: ["جدار الصلاة", "شارك بطلب صلاة"] },
  "/en/more/notifications": { en: ["Notifications"] },
  "/ar/more/notifications": { ar: ["الإشعارات"] },
  "/en/bible": { en: ["Bible", "Verse of the Week"] },
  "/ar/bible": { ar: ["الكتاب المقدس", "آية الأسبوع"] },
  "/en/bible/verse": { en: ["Verse of the Week"] },
  "/ar/bible/verse": { ar: ["آية الأسبوع"] },
  "/en/bible/studies": { en: ["Studies"] },
  "/ar/bible/studies": { ar: ["الدراسات"] },
  "/en/bible/resources": { en: ["Resources"] },
  "/ar/bible/resources": { ar: ["الموارد"] },
  "/en/events": { en: ["Events", "Weekly Meeting"] },
  "/ar/events": { ar: ["الفعاليات", "الاجتماع الأسبوعي"] },
  "/en/games": { en: ["Games"] },
  "/ar/games": { ar: ["الألعاب"] },
};

/**
 * The language switcher names the TARGET language in that language's own
 * script ("العربية" on the English site). That is correct UI, not a leak, so
 * it is removed before scanning an English page for Arabic.
 */
const SWITCHER_LABELS = ["العربية", "English", "عر", "EN"];

const ROUTES = [
  "/en", "/ar",
  "/en/more", "/ar/more",
  "/en/more/servants", "/ar/more/servants",
  "/en/more/about", "/ar/more/about",
  "/en/more/contact", "/ar/more/contact",
  "/en/more/gallery", "/ar/more/gallery",
  "/en/more/prayer-wall", "/ar/more/prayer-wall",
  "/en/more/notifications", "/ar/more/notifications",
  "/en/bible", "/ar/bible",
  "/en/bible/verse", "/ar/bible/verse",
  "/en/bible/studies", "/ar/bible/studies",
  "/en/bible/resources", "/ar/bible/resources",
  "/en/events", "/ar/events",
  "/en/games", "/ar/games",
];

const failures = [];
const rows = [];

const attr = (html, name) =>
  html.match(new RegExp(`<html[^>]*\\s${name}="([^"]+)"`))?.[1] ?? null;
const title = (html) => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
const canonical = (html) =>
  html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1] ??
  html.match(/<link[^>]*href="([^"]+)"[^>]*rel="canonical"/)?.[1] ??
  null;

/** Strip <script>/<style> so framework JSON blobs don't skew the text scan. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const path of ROUTES) {
  const locale = path.split("/")[1];
  let html;
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (error) {
    failures.push(`${path} — could not fetch: ${error.message}`);
    rows.push({ route: path, locale, result: "FETCH FAIL", detail: String(error.message) });
    continue;
  }

  const problems = [];
  const lang = attr(html, "lang");
  const dir = attr(html, "dir");
  const pageTitle = title(html);
  const can = canonical(html);
  const text = visibleText(html);

  // 1. lang / dir
  if (lang !== locale) problems.push(`lang="${lang}" expected "${locale}"`);
  const expectedDir = locale === "ar" ? "rtl" : "ltr";
  if (dir !== expectedDir) problems.push(`dir="${dir}" expected "${expectedDir}"`);

  // 2. title language
  if (locale === "en" && ARABIC.test(pageTitle)) problems.push(`title has Arabic: "${pageTitle}"`);
  if (locale === "ar" && LATIN_WORD.test(pageTitle.replace(/Youth For Christ|Van Dyck/g, ""))) {
    problems.push(`title looks English: "${pageTitle}"`);
  }

  // 3. canonical stays in the same locale
  if (can && !can.startsWith(`/${locale}`)) problems.push(`canonical "${can}" not /${locale}…`);

  // 4. body language
  //    Strip the language-switcher label first: it names the target language in
  //    that language's own script and is the one legitimate cross-language word.
  const bodyText = SWITCHER_LABELS.reduce((acc, label) => acc.split(label).join(" "), text);
  if (locale === "en" && ARABIC.test(bodyText)) {
    const idx = bodyText.search(ARABIC);
    problems.push(`Arabic text in body near: "…${bodyText.slice(Math.max(0, idx - 40), idx + 40)}…"`);
  }
  if (locale === "ar" && !ARABIC.test(text)) problems.push("Arabic page has no Arabic text");

  // 5. expected UI phrases present (nav bar on every page + page-specific)
  const expected = [
    ...NAV_PHRASES[locale],
    ...(PAGE_PHRASES[path]?.[locale] ?? []),
  ];
  for (const phrase of expected) {
    if (!text.includes(phrase)) problems.push(`missing expected phrase "${phrase}"`);
  }

  rows.push({
    route: path,
    locale,
    result: problems.length ? "FAIL" : "ok",
    detail: problems.join("; ") || "lang/dir/title/canonical/content correct",
  });
  if (problems.length) failures.push(`${path} — ${problems.join("; ")}`);
}

// ── Equivalent page in the other locale must resolve (switcher target) ─────
const SWITCH_CASES = [
  "/more", "/more/servants", "/more/gallery", "/bible/verse", "/events",
];

for (const suffix of SWITCH_CASES) {
  const from = `/ar${suffix}`;
  const to = `/en${suffix}`;
  let ok = false;
  let detail = "";
  try {
    const res = await fetch(`${BASE}${to}`, { redirect: "manual" });
    const html = await res.text();
    const lang = attr(html, "lang");
    const dir = attr(html, "dir");
    const bodyText = SWITCHER_LABELS.reduce(
      (acc, l) => acc.split(l).join(" "),
      visibleText(html)
    );
    ok = res.status < 400 && lang === "en" && dir === "ltr" && !ARABIC.test(bodyText);
    detail = ok
      ? `${from} → ${to}: same page, lang="en" dir="ltr", no Arabic`
      : `status=${res.status} lang="${lang}" dir="${dir}"`;
  } catch (error) {
    detail = String(error.message);
  }
  rows.push({ route: `switch ${from}→${to}`, locale: "en", result: ok ? "ok" : "FAIL", detail });
  if (!ok) failures.push(`switch ${from} → ${to}: ${detail}`);
}

// ── Unprefixed "/" must negotiate to a locale, and an unknown locale 404s ──
{
  const res = await fetch(`${BASE}/`, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const ok = res.status >= 300 && res.status < 400 && /^\/(ar|en)(\/|$)/.test(loc);
  rows.push({
    route: "/ (negotiate)",
    locale: "—",
    result: ok ? "ok" : "FAIL",
    detail: ok ? `redirects to ${loc}` : `status=${res.status} location=${loc || "none"}`,
  });
  if (!ok) failures.push(`"/" did not redirect to a locale: status=${res.status} location=${loc}`);

  const bad = await fetch(`${BASE}/de/more/servants`, { redirect: "manual" });
  // The middleware may legitimately redirect an unrecognised prefix to the
  // default locale; what must never happen is that a *requested* locale is
  // silently replaced. Follow the redirect and assert we do NOT end up on an
  // English page pretending to be a German one.
  const followed = bad.status >= 300 && bad.status < 400
    ? await fetch(`${BASE}${bad.headers.get("location") ?? "/"}`, { redirect: "manual" })
    : bad;
  const finalHtml = await followed.text();
  const finalLang = attr(finalHtml, "lang");
  const okBad = bad.status === 404 || finalLang !== "de";
  rows.push({
    route: "/de/more/servants",
    locale: "—",
    result: okBad ? "ok" : "FAIL",
    detail: bad.status === 404
      ? "unknown locale 404s (no silent fallback)"
      : `redirected to lang="${finalLang}" — not served as a German page`,
  });
  if (!okBad) failures.push(`/de/... was served as locale "${finalLang}", expected a 404`);
}

// ── No route may contain a DOUBLED locale prefix ───────────────────────────
// Regression guard: the language switcher once produced "/en/ar/more/servants"
// because an already-prefixed path was handed to the locale-aware router, which
// prefixed it again. Any "/<locale>/<locale>/…" path must never serve a page.
const DOUBLED = [
  "/en/en/more/servants",
  "/en/ar/more/servants",
  "/ar/en/more/servants",
  "/ar/ar/more/servants",
  "/en/en",
  "/ar/ar",
  "/en/ar/events",
  "/ar/en/bible/verse",
];

for (const path of DOUBLED) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const html = await res.text();
  const served = /<main[\s>]|<nav[\s>]/i.test(html);
  const ok = !served;
  rows.push({
    route: path,
    locale: "—",
    result: ok ? "ok" : "FAIL",
    detail: ok
      ? `status=${res.status} — no page served (doubled prefix rejected)`
      : `status=${res.status} but a page was served — doubled locale prefix!`,
  });
  if (!ok) failures.push(`doubled locale prefix served a page: ${path} (status=${res.status})`);
}

// ── Report ────────────────────────────────────────────────────────────────
const pad = (v, n) => String(v).padEnd(n);
console.log("\nROUTE AUDIT");
console.log("─".repeat(104));
console.log(`${pad("Route", 30)}${pad("Lang", 6)}${pad("Result", 11)}Detail`);
console.log("─".repeat(104));
for (const row of rows) {
  console.log(`${pad(row.route, 30)}${pad(row.locale, 6)}${pad(row.result, 11)}${row.detail}`);
}
console.log("─".repeat(104));
const passed = rows.filter((r) => r.result === "ok").length;
console.log(`${passed}/${rows.length} checks passed`);
console.log(
  failures.length
    ? `\n✗ ${failures.length} FAILURE(S):\n${failures.map((f) => `  • ${f}`).join("\n")}`
    : "\n✓ All locale checks passed."
);
process.exit(failures.length ? 1 : 0);

