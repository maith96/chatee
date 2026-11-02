// Admin leaderboard: how each stranger does, overall or within one user group, with suggestions.
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPerformance, PROVEN_AT, type PerfRow } from "./stranger-matching";
import { listStrangers, type Stranger } from "./strangers";

export const MIN_USERS = 5; // below this, rates are hidden (same rule as the rest of the stats page)

export type LeaderRow = {
  id: string;
  name: string;
  status: string;
  avatar_url: string | null;
  gender: string;
  age_band: string;
  region: string;
  city: string;
  users: number;
  contacts: number;
  decided: number;
  score: number | null; // 0..1, smoothed
  low: number | null;
  high: number | null;
  answered: number | null;
  reached10: number | null;
  returned: number | null;
  blocked: number;
  thumbs: { up: number; down: number };
  suggestion: "ready to activate" | "consider retiring" | "needs more data" | null;
};

type RawRow = PerfRow & { answered: number; reached10: number; returned: number; blocked: number; thumbs_up: number; thumbs_down: number };

async function loadRaw(db: SupabaseClient): Promise<RawRow[] | null> {
  const { data, error } = await db.rpc("stranger_performance");
  if (error) return null;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    persona_id: String(r.persona_id),
    segment: String(r.segment),
    region: String(r.region),
    users: Number(r.users),
    contacts: Number(r.contacts),
    decided: Number(r.decided),
    reward: Number(r.reward),
    answered: Number(r.answered),
    reached10: Number(r.reached10),
    returned: Number(r.returned),
    blocked: Number(r.blocked),
    thumbs_up: Number(r.thumbs_up),
    thumbs_down: Number(r.thumbs_down),
  }));
}

/** Pure: builds the leaderboard from performance rows and the pool. */
export function buildLeaderboard(raw: RawRow[], strangers: Stranger[], segment?: string): LeaderRow[] {
  const rows = segment ? raw.filter((r) => r.segment === segment) : raw;
  const out = strangers
    .filter((s) => s.status !== "draft")
    .map((s): LeaderRow => {
      const mine = rows.filter((r) => r.persona_id === s.id);
      const sum = (k: keyof RawRow) => mine.reduce((acc, r) => acc + Number(r[k]), 0);
      // Users can appear in several groups only once per stranger (one contact each), so summing is safe.
      const users = sum("users");
      const decided = sum("decided");
      const reward = sum("reward");
      const enough = users >= MIN_USERS;
      const mean = (1 + reward) / (2 + decided); // smoothed: a stranger with no data sits at 0.5
      const margin = 1.96 * Math.sqrt((mean * (1 - mean)) / (decided + 3));
      const rate = (k: keyof RawRow) => (enough && decided ? sum(k) / decided : null);
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        avatar_url: s.avatar_url,
        gender: s.tags.gender,
        age_band: s.tags.age_band,
        region: s.tags.region,
        city: s.tags.city,
        users,
        contacts: sum("contacts"),
        decided,
        score: enough ? mean : null,
        low: enough ? Math.max(0, mean - margin) : null,
        high: enough ? Math.min(1, mean + margin) : null,
        answered: rate("answered"),
        reached10: rate("reached10"),
        returned: rate("returned"),
        blocked: sum("blocked"),
        thumbs: { up: enough ? sum("thumbs_up") : 0, down: enough ? sum("thumbs_down") : 0 },
        suggestion: null,
      };
    });
  // Suggestions, relative to the rest of the pool.
  const scored = out.filter((r) => r.score !== null && r.decided >= 10).map((r) => r.score!).sort((a, b) => a - b);
  const median = scored.length ? scored[Math.floor(scored.length / 2)] : null;
  // The bottom ~20% (at least 5 strangers with enough data before suggesting anything).
  const bottom = scored.length >= 5 ? scored[Math.max(0, Math.floor(scored.length * 0.2) - 1)] : null;
  for (const r of out) {
    if (r.decided < PROVEN_AT || r.score === null) r.suggestion = "needs more data";
    else if (r.status === "trial" && r.decided >= 10 && median !== null && r.score >= median) r.suggestion = "ready to activate";
    else if (r.decided >= 15 && bottom !== null && r.score <= bottom) r.suggestion = "consider retiring";
  }
  return out.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.contacts - a.contacts);
}

/** Warns if the best-performing strangers are starting to all look alike (the pool is drifting). */
export function driftWarnings(board: LeaderRow[]) {
  const top = board.filter((r) => r.score !== null).slice(0, 10);
  if (top.length < 6) return [];
  const warn: string[] = [];
  // Region isn't checked: matching users with strangers from their own region is intended.
  for (const [key, label] of [["gender", "gender"], ["age_band", "age band"]] as const) {
    const counts = new Map<string, number>();
    for (const r of top) counts.set(r[key], (counts.get(r[key]) ?? 0) + 1);
    const [value, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / top.length >= 0.7) warn.push(`${n} of the top ${top.length} strangers share the same ${label} (${value}). Draft more varied strangers so the pool doesn't collapse onto one type.`);
  }
  return warn;
}

export async function getLeaderboard(db: SupabaseClient, segment?: string) {
  const [raw, strangers] = await Promise.all([loadRaw(db), listStrangers(db).catch(() => null)]);
  if (!raw || !strangers) return null;
  const board = buildLeaderboard(raw, strangers, segment);
  const segments = [...new Set(raw.map((r) => r.segment))].filter((s) => s !== "unknown").sort();
  return { board, segments, warnings: driftWarnings(board) };
}

export { loadPerformance };
