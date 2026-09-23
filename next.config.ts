import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withPWA = require("next-pwa")({
  dest: "public",
  // IMPORTANT (OneSignal): next-pwa must NOT register /sw.js at scope "/".
  // Two service workers cannot control the same scope — /sw.js would replace
  // /OneSignalSDKWorker.js as the page controller and incoming push events
  // would never reach OneSignal's handler. Symptom: dashboard says
  // "Delivered" but nothing is ever displayed.
  // sw.js is still generated but left unregistered (inert) until we move to a
  // combined worker (InjectManifest + importScripts OneSignal SDK).
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  exclude: [/OneSignalSDKWorker/, /OneSignalSDKUpdaterWorker/],
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default withPWA(withNextIntl(nextConfig));
