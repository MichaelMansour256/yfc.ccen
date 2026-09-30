/**
 * /{locale}/more/prayer-wall — server shell.
 *
 * The wall itself is a client component (fetch + localStorage read-state), so
 * the route is split: this module owns the locale-aware <head>.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import PrayerWallView from "./PrayerWallView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("prayerWall", { path: "/more/prayer-wall" });
}

export default function PrayerWallPage() {
  return <PrayerWallView />;
}
