import type { Metadata } from "next";
import { SITE } from "./site";

/** The share image from app/opengraph-image.tsx (1200×630). */
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: "Sasamigo: friends who remember. AI friends, made in Kenya." };

/**
 * Complete search + share metadata for one public page.
 * Next.js replaces (doesn't merge) `openGraph` and `twitter` from the layout when a page sets them,
 * so every page builds the full set here instead of setting a few fields.
 */
export function pageMetadata({ title, description = SITE.description, path }: { title?: string; description?: string; path: string }): Metadata {
  const shareTitle = title ? `${title} · ${SITE.name}` : "Sasamigo: friends who remember";
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE.name, locale: "en_KE", url: path, title: shareTitle, description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [SHARE_IMAGE] },
  };
}
