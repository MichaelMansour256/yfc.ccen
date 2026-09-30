/**
 * /{locale}/more/gallery — server shell.
 *
 * The gallery itself is a client component (it fetches Cloudinary folders and
 * owns the slideshow state), so the route is split in two: this server module
 * owns the locale-aware <head> (title / description / canonical / hreflang)
 * and `GalleryView` owns the UI. A "use client" module cannot export
 * `generateMetadata`, which is exactly why the split exists.
 */
import type { Metadata } from "next";
import { buildMetadata } from "@/i18n/metadata";
import GalleryView from "./GalleryView";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("gallery", { path: "/more/gallery" });
}

export default function GalleryPage() {
  return <GalleryView />;
}
