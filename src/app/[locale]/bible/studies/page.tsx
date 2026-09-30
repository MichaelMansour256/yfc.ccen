/**
 * /{locale}/bible/studies — server shell.
 *
 * The listing is a client component (it reads the deep-link search params and
 * owns the filter state), so the route is split: this module owns the
 * locale-aware <head>.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import StudiesView from "./StudiesView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("content", { path: "/bible/studies" });
}

export default function StudiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StudiesView searchParams={searchParams} />;
}
