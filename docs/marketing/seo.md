# SEO for sasamigo.com

Written 6 Nov 2026. Search volumes and difficulty are **not verified**: the SEO data tools (Ahrefs,
Similarweb) weren't connected, so keyword ideas below are marked `[volume?]`. Check them in Google Search
Console after a few weeks of data, or with a keyword tool, before writing content around them.

## What's in the code now

| Check | Status | Where |
|---|---|---|
| Crawlers can reach robots.txt, sitemap.xml and the share image while signed out | ✅ Fixed (they used to redirect to /login) | `src/proxy.ts` (`SEO_FILES`) |
| robots.txt: crawl public pages, skip `/api/`, `/admin/`, `/auth/` | ✅ | `src/app/robots.ts` |
| sitemap.xml: `/`, `/privacy`, `/terms` | ✅ | `src/app/sitemap.ts` |
| Titles: home 52 characters, other pages "X · Sasamigo" | ✅ | `src/app/layout.tsx` |
| Meta description: 148 characters, true claims only | ✅ | `SITE.description` in `src/lib/site.ts` |
| Canonical link on every public page | ✅ | `pageMetadata()` in `src/lib/seo.ts` |
| Share previews (WhatsApp, X, LinkedIn, Facebook): title, description, 1200×630 image | ✅ | `src/app/opengraph-image.tsx` |
| Structured data: Organization, WebSite, WebApplication (free, 18+), no ratings | ✅ | `JSON_LD` in `src/components/landing.tsx` |
| Login page and admin pages kept out of search results (`noindex`) | ✅ | `src/app/login/layout.tsx`, `src/app/admin/layout.tsx` |
| One H1 per page, alt text on character images | ✅ Already there | `landing.tsx` |
| HTTPS, mobile viewport, fast static legal pages | ✅ Vercel / Next.js | n/a |

**Rule for future public pages:** use `export const metadata = pageMetadata({ title, description, path })` and add the
page to `src/app/sitemap.ts`.

## Do after deploying (founder, ~30 minutes, free)

1. **Google Search Console** (already verified for sasamigo.com): Sitemaps → submit `https://sasamigo.com/sitemap.xml`,
   then URL Inspection → `https://sasamigo.com` → Request indexing.
2. **Bing Webmaster Tools** (bing.com/webmasters): "Import from Google Search Console". Bing also feeds
   other search engines and some AI assistants.
3. **Check structured data:** https://search.google.com/test/rich-results with `https://sasamigo.com`.
4. **Check share previews:** paste the link into a WhatsApp chat with yourself, and into
   https://www.opengraph.xyz. WhatsApp caches previews, so check after deploying.
5. Note: Google can take days to weeks to show a new site.

## Keyword ideas (volume unverified)

| Keyword | Intent | Fit | Where it would go |
|---|---|---|---|
| sasamigo | Navigational | Must own | Home (done) |
| AI friend app Kenya `[volume?]` | Commercial | High | Home title and description (done) |
| AI chat app Kenya `[volume?]` | Commercial | High | Home, future FAQ |
| AI companion app (friendship, not romance) `[volume?]` | Commercial | Medium: competitive, global | FAQ, "how it's different" page |
| Character AI alternative `[volume?]` | Commercial | Medium: competitive | Comparison page (honest, no attacks) |
| AI that remembers you / AI friend with memory `[volume?]` | Commercial | High: core feature | Feature page or FAQ |
| Is it safe to talk to an AI friend? `[volume?]` | Informational | High: trust | FAQ (privacy, deletion, "always AI") |
| Swahili / Sheng AI chat `[volume?]` | Commercial | Medium: only if the product supports it well | Later |

Don't target: loneliness, therapy, mental health or "AI girlfriend" terms. They conflict with the brand
rules (friendship-first, no therapy claims) and attract the wrong audience.

## Content to add later (priority order)

1. **FAQ section on the home page** (half a day): "Is it a real person?", "What do they remember and can I
   delete it?", "Is it free?", "Who's it for?". Answers real questions, can add `FAQPage` structured data,
   and covers the trust keywords.
2. **A public page per character** (`/friends/juno` etc., moderate): name, personality, sample chat. Gives
   search engines more real pages and gives TikTok clips a link target. Start with Juno, Miles and Cole
   (the campaign plan keeps Elena and Lila out of public promotion).
3. **Links from Kenyan sites** (ongoing): Kenyan tech blogs and newsletters, campus club pages, event
   listings (Latitude59, accelerator profiles). One honest founder story is worth more than many directory
   listings. Never buy links.

## Not done / decided against

- **No fake numbers in structured data** (ratings, review counts, user counts). Add `aggregateRating` only
  from real, public reviews.
- **No `keywords` meta tag:** Google ignores it.
- The landing page renders per request (it checks login first). That's fine for Google, but if
  speed scores in Search Console show problems, the signed-out landing could be made static.
