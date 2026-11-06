import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// sitemap.xml: the public pages. Add new public pages here (e.g. a blog or a page per character).
// lastModified for the legal pages follows SITE.legalUpdated, so update that date when you edit them.
export default function sitemap(): MetadataRoute.Sitemap {
  const legal = new Date(SITE.legalUpdated);
  return [
    { url: SITE.url, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/privacy`, lastModified: legal, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/terms`, lastModified: legal, changeFrequency: "yearly", priority: 0.3 },
  ];
}
