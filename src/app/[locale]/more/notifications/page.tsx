/**
 * /{locale}/more/notifications — server shell.
 *
 * The inbox is a client component (fetches + subscribes to read-state), so
 * the route is split: this module owns the locale-aware <head>.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import NotificationsView from "./NotificationsView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("notifications", { path: "/more/notifications" });
}

export default function NotificationsPage() {
  return <NotificationsView />;
}
