/**
 * /{locale}/events — server shell.
 *
 * The events view is a client component (it fetches /api/events and
 * /api/invitations), so the route is split: this module owns the
 * locale-aware <head>, `EventsView` owns the UI.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import EventsView from "./EventsView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("events", { path: "/events" });
}

export default function EventsPage() {
  return <EventsView />;
}
