/**
 * Layout for the public check-in route (/checkin/[token]).
 *
 * This subtree sits OUTSIDE the [locale] layout on purpose: a QR scan must load
 * the smallest possible page on a phone in a crowded meeting. No bottom nav, no
 * OneSignal SDK, no gallery code — just the theme, the Arabic font and one card.
 *
 * Like /admin, it provides its own <html>, applies the live theme variables from
 * src/config/theme.ts and imports the global stylesheet (which the root layout
 * only imports for the site shell).
 */
import type { Metadata, Viewport } from "next";
import "../globals.css";
import { themeCssVars } from "@/config";
import { Cairo } from "next/font/google";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "600", "700"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "تسجيل الحضور",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f1f5c",
};

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <head>
        {/* Check-in results must never be cached or prefetched. */}
        <meta httpEquiv="Cache-Control" content="no-store" />
      </head>
      <body className="page-gradient-high">
        <style dangerouslySetInnerHTML={{ __html: themeCssVars() }} />
        {children}
      </body>
    </html>
  );
}
