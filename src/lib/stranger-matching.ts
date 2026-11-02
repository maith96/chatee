// Strangers part 3: which stranger to introduce to a user.
// 80% of the time: the stranger most likely to do well with users like this one (Thompson sampling on a
// healthy-engagement score, from the user's own group if there's enough data, else their region, else everyone).
// 20% of the time: a stranger with little data yet, so new ones get a fair chance.
// Users are grouped only by region, texting style and interests: never gender, ethnicity or looks.
// Diversity limits stop any one user from only ever meeting the same kind of person.
import type { SupabaseClient } from "@supabase/supabase-js";
import { newsOverview } from "./news";
import { regionFromTimezone } from "./news-sources";
import { countWords } from "./reply-stats";

export const EXPLORE_SHARE = 0.2;
export const PROVEN_AT = 5; // decided contacts before a stranger's score is trusted

export type RegionGroup = "kenya" | "africa" | "world";
export type PerfRow = { persona_id: string; segment: string; region: string; users: number; contacts: number; decided: number; reward: number };
export type Candidate = { id: string; status: string; tags: { gender?: string; age_band?: string; region?: string } };
export type RecentContact = { gender?: string; age_band?: string };

export function regionGroup(timezone?: string): RegionGroup | null {
  const r = regionFromTimezone(timezone);
  if (!r) return null;
  return r === "kenya" ? "kenya" : r === "africa" ? "africa" : "world";
}

/** The user's group, from metadata only: region, how much they write, and the news topic they engage with most. */
export async function userSegment(db: SupabaseClient, timezone?: string) {
  const region = regionGroup(timezone) ?? "world";
  const { data } = await db.from("messages").select("words, content").eq("role", "user").order("created_at", { ascending: false }).limit(30);
  const msgs = data ?? [];
  const avg = msgs.length ? msgs.reduce((s, m) => s + ((m.words as number | null) ?? countWords(String(m.content ?? ""))), 0) / msgs.length : 0;
  const texting = msgs.length < 10 ? "new" : avg <= 6 ? "brief" : avg >= 20 ? "chatty" : "medium";
  const learned = await newsOverview(db, timezone).catch(() => null);
  const top = learned?.learned.topics.find((t) => t.mentions >= 3 && t.engagement >= 0.6);
  return { region, segment: `${region}.${texting}.${top?.id ?? "general"}` };
}

export async function loadPerformance(db: SupabaseClient): Promise<PerfRow[] | null> {
  const { data, error } = await db.rpc("stranger_performance");
  if (error) return null; // schema v10 not run yet: fall back to simple picking
  return (data ?? []).map((r: Record<string, unknown>) => ({
    persona_id: String(r.persona_id),
    segment: String(r.segment),
    region: String(r.region),
    users: Number(r.users),
    contacts: Number(r.contacts),
    decided: Number(r.decided),
    reward: Number(r.reward),
  }));
}

/** A stranger's counts at the most specific level with enough data: the user's group, their region, or everyone. */
export function levelCounts(rows: PerfRow[], personaId: string, segment: string, region: string) {
  const mine = rows.filter((r) => r.persona_id === personaId);
  const sum = (xs: PerfRow[]) => ({ decided: xs.reduce((s, r) => s + r.decided, 0), reward: xs.reduce((s, r) => s + r.reward, 0) });
  const seg = sum(mine.filter((r) => r.segment === segment));
  if (seg.decided >= PROVEN_AT) return { ...seg, level: "group" as const };
  const reg = sum(mine.filter((r) => r.region === region));
  if (reg.decided >= PROVEN_AT) return { ...reg, level: "region" as const };
  return { ...sum(mine), level: "everyone" as const };
}

// ---------- sampling ---------------------------------------------------------------------------

function normal(rand: () => number) {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
/** Marsaglia–Tsang gamma sampler (shape >= 1). */
function gamma(shape: number, rand: () => number): number {
  if (shape < 1) return gamma(shape + 1, rand) * Math.pow(rand(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = normal(rand);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    if (Math.log(rand()) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}
export function betaSample(a: number, b: number, rand: () => number) {
  const x = gamma(a, rand);
  return x / (x + gamma(b, rand));
}

/** Keeps a user's recent strangers varied: not 4 of the same gender, or 3 from the same age band, in a row. */
export function diversityFilter(candidates: Candidate[], recent: RecentContact[]) {
  const sameRun = (key: "gender" | "age_band", n: number, value?: string) =>
    !!value && recent.length >= n && recent.slice(0, n).every((r) => r[key] === value);
  const ok = candidates.filter((c) => !sameRun("gender", 3, c.tags.gender) && !sameRun("age_band", 2, c.tags.age_band));
  return ok.length ? ok : candidates;
}

/** Pure: picks one candidate. `recent` is the user's latest strangers, newest first. */
export function chooseStranger(
  candidates: Candidate[],
  ctx: { rows: PerfRow[]; segment: string; region: string; recent: RecentContact[]; rand?: () => number },
) {
  const rand = ctx.rand ?? Math.random;
  if (!candidates.length) return null;
  const pool = diversityFilter(candidates, ctx.recent);
  const scored = pool.map((c) => ({ c, counts: levelCounts(ctx.rows, c.id, ctx.segment, ctx.region) }));
  const unproven = scored.filter((s) => s.counts.decided < PROVEN_AT);
  const proven = scored.filter((s) => s.counts.decided >= PROVEN_AT);
  // Explore: strangers with too little data, or (once everyone has some) the least-tested half,
  // so exploration never stops and newer strangers keep getting chances.
  const byData = [...scored].sort((x, y) => x.counts.decided - y.counts.decided);
  const leastTested = unproven.length ? unproven : byData.slice(0, Math.max(1, Math.ceil(byData.length / 2)));
  if (!proven.length || rand() < EXPLORE_SHARE) {
    // Mostly the user's own region while exploring, so first impressions are relevant.
    const local = leastTested.filter((s) => s.c.tags.region === ctx.region);
    const from = local.length && rand() < 0.6 ? local : leastTested;
    return { id: from[Math.floor(rand() * from.length)].c.id, mode: "explore" as const };
  }
  // Exploit: Thompson sampling, with a small preference for the user's own region.
  let best: { id: string; draw: number } | null = null;
  for (const s of proven) {
    const draw = betaSample(1 + s.counts.reward, 1 + s.counts.decided - s.counts.reward, rand) * (s.c.tags.region === ctx.region ? 1.1 : 1);
    if (!best || draw > best.draw) best = { id: s.c.id, draw };
  }
  return { id: best!.id, mode: "exploit" as const };
}
