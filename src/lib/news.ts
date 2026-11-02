// Picks which news items a persona knows about for a reply, and learns what each user engages with.
// Learning uses metadata only (topic, region, whether they engaged), is resettable, and the user can
// override it by choosing regions/topics, or switch news off.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchema } from "./db-errors";
import type { DigestItem } from "./news-digest";
import { isRegion, isTopic, PARENT_REGION, regionFromTimezone, REGIONS, TOPICS, type Region, type Topic } from "./news-sources";
import type { PersonaDefinition } from "./persona-schema";
import { countWords } from "./reply-stats";

const ITEMS_PER_REPLY = 4;
const DIGEST_WINDOW_HOURS = 48;
const LEARN_DAYS = 60;
const PENDING_HOURS = 24; // a mention with no reply after this counts as not engaged

export type NewsItem = Pick<DigestItem, "id" | "title" | "summary" | "topic" | "region" | "sensitive" | "political" | "published_at">;

export type NewsPrefs = { enabled: boolean; regions: Region[]; topics: Topic[]; resetAt: string | null };
type Mention = { item_id: string; conversation_id: string; topic: string; region: string; engaged: boolean | null; created_at: string };

const STOP = new Set(
  "the and for with that this from into after over amid says said will have has been were what when where which their there about more than first last year years new news live latest just also could would should after before under against between".split(" "),
);
/** Distinctive words of a text (for spotting mentions and engagement). */
export function keywords(text: string) {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 4 && !STOP.has(w)))];
}

// ---------- prefs + learning -------------------------------------------------------------------

export async function getNewsPrefs(db: SupabaseClient): Promise<NewsPrefs> {
  const { data, error } = await db.from("profiles").select("news_enabled, news_regions, news_topics, news_reset_at").maybeSingle();
  if (error && isMissingSchema(error)) return { enabled: true, regions: [], topics: [], resetAt: null };
  if (error) throw error;
  return {
    enabled: (data?.news_enabled as boolean | undefined) ?? true,
    regions: ((data?.news_regions as string[] | null) ?? []).filter(isRegion),
    topics: ((data?.news_topics as string[] | null) ?? []).filter(isTopic),
    resetAt: (data?.news_reset_at as string | null) ?? null,
  };
}

export async function setNewsPrefs(
  db: SupabaseClient,
  userId: string,
  patch: { enabled?: boolean; regions?: Region[]; topics?: Topic[]; reset?: boolean },
) {
  const row: Record<string, unknown> = { user_id: userId };
  if (patch.enabled !== undefined) row.news_enabled = patch.enabled;
  if (patch.regions) row.news_regions = patch.regions;
  if (patch.topics) row.news_topics = patch.topics;
  if (patch.reset) row.news_reset_at = new Date().toISOString();
  const { error } = await db.from("profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

async function recentMentions(db: SupabaseClient, resetAt: string | null): Promise<Mention[]> {
  const since = new Date(Date.now() - LEARN_DAYS * 86_400_000).toISOString();
  const from = resetAt && resetAt > since ? resetAt : since;
  const { data, error } = await db
    .from("news_mentions")
    .select("item_id, conversation_id, topic, region, engaged, created_at")
    .gte("created_at", from)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error && isMissingSchema(error)) return [];
  if (error) throw error;
  return (data ?? []) as Mention[];
}

/** Engagement rate per topic and region, smoothed so a single mention doesn't swing it (0.5 = no info). */
export function learnedWeights(mentions: Mention[], now = Date.now()) {
  const tally = <K extends string>(keys: readonly K[], pick: (m: Mention) => string) => {
    const out = {} as Record<K, { rate: number; n: number }>;
    for (const k of keys) {
      const decided = mentions.filter((m) => pick(m) === k && (m.engaged != null || now - Date.parse(m.created_at) > PENDING_HOURS * 3_600_000));
      const engaged = decided.filter((m) => m.engaged).length;
      out[k] = { rate: (engaged + 1) / (decided.length + 2), n: decided.length };
    }
    return out;
  };
  return { topics: tally(TOPICS, (m) => m.topic), regions: tally(REGIONS, (m) => m.region) };
}

// ---------- choosing items ---------------------------------------------------------------------

export type NewsContext = { items: NewsItem[]; recentlyMentioned: boolean };

/** Pure: ranks the digest for this user and persona. */
export function rankNews(
  items: NewsItem[],
  opts: {
    prefs: NewsPrefs;
    homeRegion: Region | null;
    weights: ReturnType<typeof learnedWeights>;
    persona: PersonaDefinition;
    alreadyMentioned: Set<string>;
    now?: number;
  },
) {
  const now = opts.now ?? Date.now();
  const interests = new Set(keywords([...opts.persona.knowledge.interests, ...opts.persona.personality.traits].join(" ")));
  const scored = items
    .filter((i) => !opts.alreadyMentioned.has(i.id))
    .map((i) => {
      let score = 1;
      const parent = PARENT_REGION[i.region];
      if (opts.prefs.regions.length) {
        if (opts.prefs.regions.includes(i.region) || (parent && opts.prefs.regions.includes(parent))) score += 2;
        else if (i.region === "global") score += 0.5;
        else return null;
      } else {
        if (i.region === opts.homeRegion) score += 1.5;
        else if (opts.homeRegion && PARENT_REGION[opts.homeRegion] === i.region) score += 1; // e.g. Africa for a Kenyan user
        else if (i.region === "global") score += 1;
        score += opts.weights.regions[i.region].rate * 3;
      }
      if (opts.prefs.topics.length) {
        if (opts.prefs.topics.includes(i.topic)) score += 2;
        else score -= 1;
      } else score += opts.weights.topics[i.topic].rate * 5; // what they actually engage with counts most
      // Things this persona would naturally care about.
      const hits = keywords(`${i.title} ${i.summary}`).filter((w) => interests.has(w)).length;
      score += Math.min(3, hits * 1.5);
      if (i.published_at) score -= Math.min(2, (now - Date.parse(i.published_at)) / 3_600_000 / 24);
      // Tragedies are only there so the persona isn't clueless if the user brings one up.
      if (i.sensitive) score -= 2;
      return { item: i, score };
    })
    .filter((x): x is { item: NewsItem; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id)); // stable, so the set doesn't shuffle between messages
  // Variety: at most 2 per topic.
  const picked: NewsItem[] = [];
  const perTopic: Record<string, number> = {};
  let sensitive = 0;
  for (const { item } of scored) {
    if ((perTopic[item.topic] ?? 0) >= 2) continue;
    if (item.sensitive && sensitive++ >= 1) continue;
    perTopic[item.topic] = (perTopic[item.topic] ?? 0) + 1;
    picked.push(item);
    if (picked.length >= ITEMS_PER_REPLY) break;
  }
  return picked;
}

/** The news this persona "knows" for this reply, or null when news is off or there's none yet. */
export async function loadNews(
  db: SupabaseClient,
  opts: { persona: { definition: PersonaDefinition }; conversationId: string; timezone?: string },
): Promise<NewsContext | null> {
  const prefs = await getNewsPrefs(db);
  if (!prefs.enabled) return null;
  const since = new Date(Date.now() - DIGEST_WINDOW_HOURS * 3_600_000).toISOString();
  const { data, error } = await db
    .from("news_items")
    .select("id, title, summary, topic, region, sensitive, political, published_at")
    .gte("fetched_at", since)
    .order("fetched_at", { ascending: false })
    .limit(120);
  if (error && isMissingSchema(error)) return null;
  if (error) throw error;
  if (!data?.length) return null;
  const mentions = await recentMentions(db, prefs.resetAt);
  const items = rankNews(data as NewsItem[], {
    prefs,
    homeRegion: regionFromTimezone(opts.timezone),
    weights: learnedWeights(mentions),
    persona: opts.persona.definition,
    alreadyMentioned: new Set(mentions.map((m) => m.item_id)),
  });
  const recentlyMentioned = mentions.some(
    (m) => m.conversation_id === opts.conversationId && Date.now() - Date.parse(m.created_at) < 3 * 3_600_000,
  );
  return items.length ? { items, recentlyMentioned } : null;
}

// ---------- after a reply: what was mentioned, and did the user engage? -------------------------

/** Items the reply clearly talks about (shares several distinctive words with the headline or summary). */
export function mentionedItems(reply: string, items: NewsItem[]) {
  const words = new Set(keywords(reply));
  return items.filter((i) => {
    const story = keywords(`${i.title} ${i.summary}`);
    const hits = story.filter((w) => words.has(w)).length;
    return hits >= Math.min(2, story.length) && hits > 0;
  });
}

/** The user engaged if they replied about it (shared words) or wrote at length right after. */
export function isEngaged(userText: string, itemKeywords: string[]) {
  const words = new Set(keywords(userText));
  return itemKeywords.some((w) => w.length >= 5 && words.has(w)) || countWords(userText) >= 12;
}

export async function recordMentions(
  db: SupabaseClient,
  opts: { conversationId: string; replyId: string; items: NewsItem[] },
) {
  if (!opts.items.length) return;
  const rows = opts.items.map((i) => ({
    conversation_id: opts.conversationId,
    reply_id: opts.replyId,
    item_id: i.id,
    topic: i.topic,
    region: i.region,
    keywords: keywords(`${i.title} ${i.summary}`).slice(0, 20),
  }));
  const { error } = await db.from("news_mentions").insert(rows);
  if (error && !isMissingSchema(error)) throw error;
}

/** Scores open mentions in this conversation against the user's new message. */
export async function scoreEngagement(db: SupabaseClient, conversationId: string, userText: string) {
  const since = new Date(Date.now() - PENDING_HOURS * 3_600_000).toISOString();
  const { data, error } = await db
    .from("news_mentions")
    .select("id, keywords, engaged, created_at")
    .eq("conversation_id", conversationId)
    .gte("created_at", since);
  if (error && isMissingSchema(error)) return;
  if (error) throw error;
  for (const m of (data ?? []).filter((x) => x.engaged == null)) {
    const engaged = isEngaged(userText, (m.keywords as string[]) ?? []);
    await db.from("news_mentions").update({ engaged }).eq("id", m.id);
  }
}

/** What's been learned, for the settings screen. */
export async function newsOverview(db: SupabaseClient, timezone?: string) {
  const prefs = await getNewsPrefs(db);
  const weights = learnedWeights(await recentMentions(db, prefs.resetAt));
  const ranked = <K extends string>(w: Record<K, { rate: number; n: number }>) =>
    (Object.entries(w) as [K, { rate: number; n: number }][])
      .filter(([, v]) => v.n >= 2)
      .sort((a, b) => b[1].rate - a[1].rate)
      .map(([k, v]) => ({ id: k, engagement: Math.round(v.rate * 100) / 100, mentions: v.n }));
  return {
    enabled: prefs.enabled,
    regions: prefs.regions,
    topics: prefs.topics,
    home_region: regionFromTimezone(timezone),
    learned: { topics: ranked(weights.topics), regions: ranked(weights.regions) },
  };
}
