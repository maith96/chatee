// Builds the shared news digest: fetch RSS feeds → condense and tag with a model → save.
// Writes go through a database function that requires NEWS_INGEST_KEY (a server-only secret),
// so users can read the news but never write it.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { isGrounded } from "./memory";
import { FEEDS, isRegion, isTopic, PARENT_REGION, type Region, type Topic } from "./news-sources";
import { resolveModel } from "./providers";

const MAX_AGE_HOURS = 36;
const PER_FEED = 8;
const MAX_ITEMS = 55;
export const REFRESH_EVERY_HOURS = 4;

export type RawItem = { id: string; title: string; description: string; url: string | null; publishedAt: string | null; source: string; region: Region; topic: Topic };
export type DigestItem = {
  id: string;
  title: string;
  summary: string;
  topic: Topic;
  region: Region;
  sensitive: boolean;
  political: boolean;
  source: string;
  url: string | null;
  published_at: string | null;
};

// ---------- RSS -------------------------------------------------------------------------------

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ") // strip tags last: descriptions often contain escaped HTML
    .replace(/\s+/g, " ")
    .trim();
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

export function parseRss(xml: string, feed: (typeof FEEDS)[number], now = Date.now()): RawItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((x) => {
      const title = tag(x, "title");
      const url = tag(x, "link") || null;
      // Some feeds write offsets as +0300; Date.parse wants +03:00.
      const date = (tag(x, "pubDate") || tag(x, "dc:date")).replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
      const time = date ? Date.parse(date) : NaN;
      return {
        id: createHash("sha1").update(url ?? title).digest("hex").slice(0, 16),
        title,
        description: tag(x, "description").slice(0, 400),
        url,
        publishedAt: Number.isNaN(time) ? null : new Date(time).toISOString(),
        source: feed.source,
        region: feed.region,
        topic: feed.topic,
      };
    })
    .filter((i) => i.title.length > 8)
    .filter((i) => !i.publishedAt || now - Date.parse(i.publishedAt) < MAX_AGE_HOURS * 3_600_000)
    .slice(0, PER_FEED);
}

export async function fetchFeeds(): Promise<RawItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "PersonaNewsBot/1.0" } });
      if (!res.ok) throw new Error(`${feed.url}: ${res.status}`);
      return parseRss(await res.text(), feed);
    }),
  );
  const seen = new Set<string>();
  const items: RawItem[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (seen.has(key) || seen.has(item.id)) continue;
      seen.add(key).add(item.id);
      items.push(item);
    }
  }
  return items;
}

// ---------- condense + tag ----------------------------------------------------------------------

const taggedItem = z.object({
  n: z.coerce.number().int(),
  summary: z.string().min(5).transform((x) => x.slice(0, 400)),
  topic: z.string(),
  region: z.string(),
  sensitive: z.boolean().optional(),
  political: z.boolean().optional(),
});
/** Each item is checked on its own, so one malformed item doesn't throw away the whole batch. */
function parseTagged(text: string) {
  const list: unknown = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
  if (!Array.isArray(list)) throw new Error("digest model didn't return a list");
  return list.flatMap((x) => {
    const r = taggedItem.safeParse(x);
    return r.success ? [r.data] : [];
  });
}

const DIGEST_PROMPT = (list: string, want: number) => `You prepare a short news digest that AI chat characters can use in casual conversation.

Headlines (number, source, feed region/topic, title — description):
${list}

Pick about ${want} of the most notable, varied stories: cover every region that has stories (at least 3 each where available, and at least 8 for kenya) and a mix of topics (not only politics and conflict; include tech, science, sport, entertainment, culture).
Merge duplicates (pick one). For each, write a neutral one-sentence summary using ONLY facts stated in its title/description. No opinions, no added details, numbers or names that aren't there.
Tag each with:
- topic: one of world, politics, business, tech, science, health, sport, entertainment, culture, climate, other
- region: one of global, africa, kenya, asia, europe, uk, north_america, latin_america, middle_east, oceania (where it mainly happens; "kenya" for Kenyan stories, "africa" for the rest of Africa; "global" if worldwide)
- sensitive: true for deaths, disasters, violence, war, abuse or other tragedies
- political: true for elections, governments, parties, policy disputes

Reply with ONLY a JSON array: [{"n": 3, "summary": "...", "topic": "tech", "region": "global", "sensitive": false, "political": false}]`;

const BATCH = 50;

/** Round-robin across feeds, so every region and topic is represented (used when the model fails). */
function spread(items: RawItem[], max: number) {
  const byFeed = new Map<string, RawItem[]>();
  for (const i of items) byFeed.set(`${i.source}:${i.region}:${i.topic}`, [...(byFeed.get(`${i.source}:${i.region}:${i.topic}`) ?? []), i]);
  const queues = [...byFeed.values()];
  const out: RawItem[] = [];
  for (let round = 0; out.length < max && queues.some((q) => q.length > round); round++)
    for (const q of queues) if (q[round] && out.length < max) out.push(q[round]);
  return out;
}

function toDigest(i: RawItem, extra?: Partial<DigestItem>): DigestItem {
  return {
    id: i.id,
    title: i.title,
    summary: i.description || i.title,
    topic: i.topic,
    region: i.region,
    sensitive: false,
    political: false,
    source: i.source,
    url: i.url,
    published_at: i.publishedAt,
    ...extra,
  };
}

/** One model call for a batch of headlines; picks about `want` of them. */
async function condenseBatch(items: RawItem[], want: number): Promise<DigestItem[]> {
  try {
    const list = items.map((i, n) => `[${n}] (${i.source}, ${i.region}/${i.topic}) ${i.title} — ${i.description}`).join("\n");
    const { languageModel, providerOptions } = resolveModel(process.env.NEWS_DIGEST_MODEL === "nova-smart" ? "nova-smart" : "nova-fast");
    const { text } = await generateText({ model: languageModel, providerOptions, maxOutputTokens: 4000, prompt: DIGEST_PROMPT(list, want) });
    const parsed = parseTagged(text);
    const out: DigestItem[] = [];
    const used = new Set<number>();
    for (const p of parsed) {
      const raw = items[p.n];
      if (!raw || used.has(p.n)) continue;
      used.add(p.n);
      // Keep the model's summary only if it's grounded in the source text; otherwise use the source's own words.
      const summary = isGrounded(p.summary, `${raw.title} ${raw.description}`) ? p.summary.trim() : raw.description || raw.title;
      // The feed knows its region best (a BBC Africa story is African). The model's tag is used for worldwide
      // feeds, to narrow a region down (an Africa story that's really about Kenya), and for world news that a
      // country's outlets report (an F1 race in Mexico on a Kenyan site isn't Kenyan news).
      const tagged = isRegion(p.region) ? p.region : null;
      const parentOfFeed = PARENT_REGION[raw.region];
      const region =
        raw.region === "global"
          ? (tagged ?? "global")
          : tagged && PARENT_REGION[tagged] === raw.region
            ? tagged
            : parentOfFeed && tagged && tagged !== parentOfFeed && tagged !== raw.region
              ? tagged
              : raw.region;
      // Same for topics: a sport feed's story is sport; general feeds get the model's topic.
      const topic = raw.topic !== "world" ? raw.topic : isTopic(p.topic) ? p.topic : raw.topic;
      out.push(toDigest(raw, { summary, topic, region, sensitive: Boolean(p.sensitive), political: Boolean(p.political) }));
    }
    if (out.length >= Math.min(3, want)) return out.slice(0, want);
    throw new Error(`digest model returned only ${out.length} usable items`);
  } catch (err) {
    console.error("News digest batch failed; using raw headlines for it:", (err as Error).message);
    return spread(items, want).map((i) => toDigest(i));
  }
}

/** Condenses raw items in parallel batches (faster, and more reliable tagging than one huge call). */
export async function condense(items: RawItem[]): Promise<DigestItem[]> {
  const batches: RawItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  const results = await Promise.all(
    batches.map((b) => condenseBatch(b, Math.max(3, Math.round((MAX_ITEMS * b.length) / Math.max(1, items.length))))),
  );
  return results.flat().slice(0, MAX_ITEMS);
}

// ---------- refresh -----------------------------------------------------------------------------

export async function newsState(db: SupabaseClient) {
  const { data, error } = await db.from("news_state").select("refreshed_at").maybeSingle();
  if (error) return null; // schema not run yet
  return (data?.refreshed_at as string | null | undefined) ?? null;
}

/**
 * Refreshes the digest if it's older than REFRESH_EVERY_HOURS (or `force`). Safe to call often:
 * the database lets only one refresh run per 10 minutes. Call it from after(), never before a reply.
 */
export async function refreshNewsIfStale(db: SupabaseClient, { force = false } = {}) {
  const key = process.env.NEWS_INGEST_KEY;
  if (!key) return { status: "disabled" as const }; // not configured
  if (!force) {
    const refreshed = await newsState(db);
    if (refreshed && Date.now() - Date.parse(refreshed) < REFRESH_EVERY_HOURS * 3_600_000) return { status: "fresh" as const };
  }
  const { data: claimed, error } = await db.rpc("news_claim_refresh", { p_key: key, p_force: force });
  if (error) throw error;
  if (!claimed) return { status: "busy" as const };
  const raw = await fetchFeeds();
  if (!raw.length) return { status: "no_feeds" as const };
  const items = await condense(raw);
  const { error: ingestError } = await db.rpc("news_ingest", { p_key: key, p_items: items });
  if (ingestError) throw ingestError;
  return { status: "refreshed" as const, items: items.length, feeds: raw.length };
}
