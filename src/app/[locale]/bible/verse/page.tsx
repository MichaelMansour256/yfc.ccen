/**
 * /{locale}/bible/verse — server shell.
 *
 * The verse view is a client component (it fetches /api/verse), so the route
 * is split in two: this module owns the locale-aware <head> (title /
 * description / canonical / hreflang) and `VerseView` owns the UI. A
 * "use client" module cannot export `generateMetadata`, which is why the split
 * exists.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import VerseView from "./VerseView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("verse", { path: "/bible/verse" });
}

export default function VerseOfWeekPage() {
  return <VerseView />;
}
