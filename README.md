<div align="center">

# E3dady Youth Meeting

### Faith • Friendship • Growth
**إيمان • أصحاب • نمو**

A mobile-first, bilingual Progressive Web App for the **E3dady Youth Meeting**
at **Christ Church – Ezbet El Nakhl** (كنيسة المسيح – عزبة النخل).

[**Live Website**](https://e3dady-ccen.vercel.app/) · [Template Guide](./TEMPLATE.md) · [Report an Issue](https://github.com/MichaelMansour256/e3dady.ccen/issues)

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Scheduled Jobs](#scheduled-jobs)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Use as a Template](#use-as-a-template)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## About

E3dady is the digital hub of the youth meeting. It keeps members connected
through the week with meeting information, Scripture content, Bible games,
photo galleries, a moderated prayer wall, and push notifications, while giving
servants a single admin dashboard to run everything, including QR-based
attendance tracking.

- **Bilingual:** Arabic and English with full RTL/LTR support.
- **Installable:** works like a native app on phones via PWA.
- **Reusable:** the meeting's identity lives in configuration, so another church
  meeting can launch its own site without rewriting components.

---

## Features

### For Members

| Area | What it offers |
| ---- | -------------- |
| **Home** | Animated hero, meeting branding, quick-access links, social links |
| **Events** | Live countdown to the next weekly meeting; scrollable date strip highlighting Fridays, upcoming, special and past events |
| **Bible** | Verse of the Week (Arabic text via GetBible, Smith & Van Dyke translation) with an optional servant note |
| **Studies & Resources** | Curated library of Bible studies and resources (PDFs, videos, audio, presentations, books, links), optionally tied to a book, chapter or verse |
| **Games** | Embedded [Verse Up Arena](https://verse-up-arena.vercel.app/) for Bible-themed games in a full-screen view |
| **Gallery** | Event-based photo albums with filtering, responsive grid, and a full-screen slideshow (swipe, keyboard, auto-play, thumbnails) |
| **Prayer Wall** | Submit requests anonymously or by name; approved requests appear publicly with a "pray" counter |
| **Servants & About** | Servants directory, meeting information, contact details |
| **Check-in** | Personal QR code scanned at the door to record attendance |
| **Push Notifications** | Web push reminders and announcements through OneSignal |

### For Servants (Admin Dashboard at `/admin`)

| Section | Capabilities |
| ------- | ------------ |
| **Gallery** | Create event folders, drag-and-drop photo uploads, delete photos |
| **Events** | Create and delete special events with Arabic and English titles, dates and times |
| **Verse** | Set the Verse of the Week by book, chapter and verse, with an optional note |
| **Content** | Manage studies and resources: draft, publish, archive, categorize |
| **Notify** | Send push notifications with title, message, destination and optional image |
| **History** | Review sent notifications and recipient counts |
| **Prayer** | Approve, reject or delete prayer requests |
| **Attendance** | Full attendance system (see below) |

### QR Attendance System

Located at `/admin/attendance`.

- **Members:** create, edit, activate or deactivate members; regenerate QR codes
- **Printable QR sheet:** bulk QR codes for all members
- **Meetings:** create, open and close meeting sessions
- **Scanner:** in-browser camera scanning with a manual fallback
- **Live dashboard:** real-time present/absent view for the open meeting
- **Reports:** date-range and per-meeting reports with attendance rate
- **Excel export:** present and absent lists via ExcelJS
- **Member history:** attendance record per member
- **Safeguards:** duplicate-scan handling, invalid or inactive QR handling, and a unique `(meeting, member)` constraint against race conditions

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4 |
| i18n | next-intl |
| PWA | next-pwa |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Media and JSON data | Cloudinary |
| Push notifications | OneSignal |
| Attendance | `qrcode`, `jsqr`, `exceljs` |
| Uploads | react-dropzone |
| Icons tooling | sharp |
| Hosting and cron | Vercel |

---

## Architecture

```
e3dady.ccen/
├── src/
│   ├── app/
│   │   ├── [locale]/            # Localized member-facing pages
│   │   │   ├── events/
│   │   │   ├── bible/           # verse, studies, resources
│   │   │   ├── games/
│   │   │   ├── checkin/[token]/ # QR check-in landing page
│   │   │   └── more/            # about, gallery, servants, prayer-wall, contact
│   │   ├── admin/               # Admin dashboard (incl. attendance/)
│   │   └── api/                 # Route handlers (gallery, events, verse, prayer,
│   │                            #   content, attendance, checkin, cron, admin)
│   ├── components/
│   ├── config/                  # Meeting identity, theme, navigation, feature flags
│   ├── hooks/
│   ├── i18n/
│   └── lib/
├── messages/                    # ar.json, en.json
├── public/                      # Logo, PWA icons, splash screens, servants photos
├── scripts/                     # Tooling (e.g. PWA icon generation)
├── supabase-*.sql               # Database migrations
├── vercel.json                  # Cron schedule
└── .env.example
```

**Data split:** relational and sensitive data (prayer requests, notification
history, attendance, content library) live in **Supabase**. Images and small
JSON documents (special events, Verse of the Week) live in **Cloudinary**.

---

## Getting Started

### Prerequisites

- Node.js (a current LTS release) and npm
- A [Supabase](https://supabase.com/) project
- A [Cloudinary](https://cloudinary.com/) account
- A [OneSignal](https://onesignal.com/) web push app

### Installation

```bash
git clone https://github.com/MichaelMansour256/e3dady.ccen.git
cd e3dady.ccen
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see [Environment Variables](#environment-variables)),
apply the [database migrations](#database-setup), then start the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>. The admin dashboard is at `/admin`.

---

## Environment Variables

Copy `.env.example` to `.env.local`. Never commit real values.

| Variable | Scope | Purpose |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Server-only key; required for staff-only attendance and content writes |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Public | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | **Secret** | Cloudinary uploads and folder management |
| `CLOUDINARY_API_SECRET` | **Secret** | Cloudinary uploads and folder management |
| `CLOUDINARY_MEETING_FOLDER` | Optional | Folder for events/verse JSON (default `e3dady_events`) |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Public | OneSignal app ID (client) |
| `ONESIGNAL_APP_ID` | **Secret** | OneSignal app ID (server; same value as above) |
| `ONESIGNAL_API_KEY` | **Secret** | OneSignal REST API key for server-side sends |
| `NEXT_PUBLIC_SITE_URL` | Public | Base URL for notification click-through links |
| `ADMIN_PASSWORD` | **Secret** | Admin dashboard password (sent as `x-admin-password`) |
| `CRON_SECRET` | **Secret** | Bearer token protecting `/api/cron/*` and `/api/test-notification` |

---

## Database Setup

Run the SQL files in the Supabase **SQL Editor**. They are written to be safe to
re-run.

| File | Purpose |
| ---- | ------- |
| `supabase-attendance-migration.sql` | Members, meetings and attendance tables, plus shared helpers |
| `supabase-attendance-lockdown.sql` | Locks attendance so it can only be written through server routes with the service role key |
| `supabase-content-library.sql` | `content_library` table for studies and resources (public read of published, non-archived rows only) |
| `supabase-notifications-history.sql` | Notification history and audit log |
| `supabase-notification-reads.sql` | Notification read tracking |

Suggested order: attendance migration, then attendance lockdown, then the rest.
Keep Row Level Security enabled on every table.

---

## Scheduled Jobs

Defined in [`vercel.json`](./vercel.json) and secured with `CRON_SECRET`.
Vercel cron schedules run in UTC.

| Endpoint | Schedule | Action |
| -------- | -------- | ------ |
| `/api/cron/meeting-reminder` | Thursdays, 17:00 UTC | Push reminder ahead of the weekly meeting |
| `/api/cron/verse-notification` | Sundays, 07:00 UTC | Push notification with the Verse of the Week |

---

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Run the production server |
| `npm run lint` | Run ESLint |
| `npm run generate-icons` | Regenerate PWA icons in `public/icons/` from `public/app-icon.png` |

---

## Deployment

The project is deployed on **Vercel**, and pushes to `main` trigger production
deployments.

1. Import the repository into Vercel.
2. Add every variable from [Environment Variables](#environment-variables) under
   **Project Settings → Environment Variables**.
3. Deploy. Cron jobs from `vercel.json` are registered automatically.

---

## Use as a Template

This repository is a **GitHub template**. Code defines *how* the site works;
configuration defines *which meeting* it represents. A new meeting site needs
configuration and asset changes, not component rewrites.

```
src/config/
├── site.ts        # Name, church, description, social links, contact, assets
├── theme.ts       # Brand colors and background gradients
├── meeting.ts     # Meeting name, age group, schedule, hero and About content
├── servants.ts    # Servants directory
├── navigation.ts  # Bottom nav, home quick links, More/Bible items
└── features.ts    # Feature flags for optional sections
```

| Layer | Where it lives |
| ----- | -------------- |
| Shared core | Pages, components, admin dashboard, integrations, schedule logic |
| Meeting-specific | `src/config/*`, `messages/{ar,en}.json`, `public/` branding assets |
| Environment-specific | `.env.local` (Supabase, Cloudinary, OneSignal, secrets, site URL) |

Step-by-step instructions: **[TEMPLATE.md](./TEMPLATE.md)**.

---

## Security

- **Secrets stay server-side.** Never expose `SUPABASE_SERVICE_ROLE_KEY`,
  `CLOUDINARY_API_SECRET`, `ONESIGNAL_API_KEY`, `ADMIN_PASSWORD` or `CRON_SECRET`.
- **Row Level Security** is enabled on all Supabase tables. Public keys can only
  read published content; writes go through authenticated server routes.
- **Attendance is staff-only.** Writes use the service role key on the server
  and are locked down with `supabase-attendance-lockdown.sql`.
- **Admin routes** require the admin password; **cron routes** require a bearer
  token.
- **Prayer requests** are moderated before they become public.
- Never commit `.env.local`, generated build output or production credentials.

Found a vulnerability? Please report it privately to the maintainers rather than
opening a public issue.

---

## Contributing

This project primarily serves the E3dady Youth Meeting, but improvements are
welcome.

1. Create a feature branch from `main`.
2. Make your changes, keeping Arabic and English strings in sync under `messages/`.
3. Run `npm run lint` and `npm run build`.
4. Test locally in both RTL and LTR.
5. Open a pull request with a clear description.

---

## License

Maintained for the E3dady Youth Meeting at Christ Church – Ezbet El Nakhl.
Unless otherwise specified, source code and original assets may not be
redistributed or used commercially without permission from the maintainers.

---

## Acknowledgements

[Next.js](https://nextjs.org/) · [React](https://react.dev/) ·
[TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS](https://tailwindcss.com/) ·
[next-intl](https://next-intl-docs.vercel.app/) · [Supabase](https://supabase.com/) ·
[Cloudinary](https://cloudinary.com/) · [OneSignal](https://onesignal.com/) ·
[Vercel](https://vercel.com/) · [GetBible API](https://api.getbible.net/)

---

<div align="center">

**E3dady Youth Meeting** · Christ Church – Ezbet El Nakhl
**Faith • Friendship • Growth**

</div>
