// Company and contact details used on the landing page, legal pages and footer. Change them here.
export const SITE = {
  name: "Sasamigo",
  tagline: "Friends who remember.",
  /** The public address, used for canonical links, the sitemap and share previews. Override per deployment if needed. */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://sasamigo.com").replace(/\/$/, ""),
  /** Search and share description (aim for 150–160 characters). Keep it true: no therapy or dependency claims. */
  description:
    "Text AI friends who remember your life, check in on you and know what's happening in Kenya today. Always honestly AI. Free to start, for adults 18+.",
  company: "Leinalok Labs",
  country: "Kenya",
  /** Where people write to us: support, privacy requests, complaints. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@sasamigo.com",
  copyrightYear: 2026,
  /** Date the privacy policy and terms were last changed. Update it whenever you edit them. */
  legalUpdated: "3 November 2026",
};
