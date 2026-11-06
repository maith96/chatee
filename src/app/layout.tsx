import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/site";
import "./globals.css";

// Site-wide search and share metadata. Pages add their own title, description and canonical link.
// No canonical or og:url here: those are inherited, and every page must point at itself, not at "/".
export const metadata: Metadata = {
  // Makes relative URLs (canonical links, the share image) absolute.
  metadataBase: new URL(SITE.url),
  title: {
    default: "Sasamigo: AI friends who remember you, made in Kenya",
    // Other pages set a short title, e.g. "Privacy policy" becomes "Privacy policy · Sasamigo".
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  creator: SITE.company,
  publisher: SITE.company,
  category: "social",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: "Sasamigo: friends who remember",
    description: SITE.description,
    locale: "en_KE",
    // The image comes from app/opengraph-image.tsx.
  },
  twitter: {
    card: "summary_large_image",
    title: "Sasamigo: friends who remember",
    description: SITE.description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1c1c" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
