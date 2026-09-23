import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import BottomNav from "@/components/BottomNav";
import OneSignalInit from "@/components/OneSignalInit";
import InstallBanner from "@/components/InstallBanner";
import { siteConfig, themeCssVars } from "@/config";
import { Cairo, Inter } from "next/font/google";

const cairo = Cairo({ subsets: ["arabic"], weight: ["400", "600", "700"], variable: "--font-cairo", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-inter", display: "swap" });

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "en" | "ar")) notFound();

  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}
      className={locale === "ar" ? cairo.variable : inter.variable}>
      <head>
        {/*
          The manifest link, theme color and apple-touch-icon live in
          `src/app/layout.tsx` metadata only — they used to be duplicated here
          with a second, conflicting theme color and with apple-touch-icon
          entries declaring sizes the referenced file never had (see
          `scripts/generate-pwa-icons.js`). Only iOS-specific meta the metadata
          API does not cover is kept below.
        */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content={siteConfig.shortName} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Apple splash screens */}
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/appstore-images/windows/SplashScreen.scale-400.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/appstore-images/windows/SplashScreen.scale-400.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/appstore-images/windows/SplashScreen.scale-200.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/appstore-images/windows/SplashScreen.scale-200.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/appstore-images/windows/SplashScreen.scale-150.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/appstore-images/windows/SplashScreen.scale-200.png" />
      </head>
      <body>
        {/* Live theme values from src/config/theme.ts (overrides the
            globals.css fallbacks — placed first in <body> so it wins the
            cascade against the stylesheet in <head>). */}
        <style dangerouslySetInnerHTML={{ __html: themeCssVars() }} />
        {/* OneSignal Web SDK v16 - next/script in component, init only after SDK loads */}
        <OneSignalInit />
        <NextIntlClientProvider messages={messages}>
          <main className="pb-safe min-h-dvh">{children}</main>
          <BottomNav locale={locale} />
          <InstallBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
