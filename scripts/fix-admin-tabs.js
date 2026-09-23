const fs = require('fs');
const c = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Tab buttons: add "history" to the list + label
const oldBtn = '{([\"gallery\", \"events\", \"verse\", \"prayer\", \"notify\"] as const).map((t) => (\n            <button key={t} onClick={() => setTab(t)}\n              className={\`rounded-xl py-2 text-sm font-semibold transition ${tab === t ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}\`}>\n              {t === "gallery" ? "🖼️ Gallery" : t === "events" ? "📅 Events" : t === "verse" ? "✨ Verse" : t === "prayer" ? "🙏 Prayer" : "🔔 Notify"}\n            </button>';
const newBtn = '{([\"gallery\", \"events\", \"verse\", \"prayer\", \"notify\", \"history\"] as const).map((t) => (\n            <button key={t} onClick={() => setTab(t)}\n              className={\`rounded-xl py-2 text-sm font-semibold transition ${tab === t ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}\`}>\n              {t === "gallery" ? "🖼️ Gallery" : t === "events" ? "📅 Events" : t === "verse" ? "✨ Verse" : t === "prayer" ? "🙏 Prayer" : t === "notify" ? "🔔 Notify" : "📜 Notification History"}\n            </button>';

if (!c.includes(oldBtn)) {
  console.log('OLD BTN NOT FOUND');
  // Print context around the gallery list
  const idx = c.indexOf('as const).map((t) =>');
  if (idx !== -1) {
    console.log('CONTEXT around map:');
    console.log(c.substring(idx - 120, idx + 260));
  }
  process.exit(1);
}

const updated = c.replace(oldBtn, newBtn);
fs.writeFileSync('src/app/admin/page.tsx', updated, 'utf8');
console.log('BUG BUTTON row updated');
