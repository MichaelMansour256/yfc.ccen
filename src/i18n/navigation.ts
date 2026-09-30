/**
 * Locale-aware navigation primitives.
 *
 * Every internal `<Link>` and `router.push()` in the app must come from here
 * instead of `next/link` + a hand-written `/${locale}${href}` template. That
 * hand-rolled concatenation was duplicated across the codebase and was the
 * single most likely source of an English page linking to an Arabic URL.
 *
 * These wrappers are built from the SAME `routing` object the middleware uses,
 * so the prefix rule exists in exactly one place.
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
