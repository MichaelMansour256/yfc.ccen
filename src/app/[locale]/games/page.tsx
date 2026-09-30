/**
 * /{locale}/games — server shell.
 *
 * The games view is a client component (it owns the fullscreen embed state),
 * so the route is split: this module owns the locale-aware <head>.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import GamesView from "./GamesView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("games", { path: "/games" });
}

export default function GamesPage() {
  return <GamesView />;
}
