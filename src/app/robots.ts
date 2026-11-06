import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// robots.txt: search engines may crawl the public pages; private app areas are off limits.
// Signed-in chats are never public anyway (they need a login), this just saves crawlers the trip.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/auth/"] },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
