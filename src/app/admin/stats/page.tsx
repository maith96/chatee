import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getStats, isAdmin, REASON_LABELS, type PersonaStatsRow, type RetentionRow } from "@/lib/feedback";
import { getModel, isModelId } from "@/lib/models";
import { describeVariant, EXPERIMENTS } from "@/lib/experiments";
import { rate, rates, verdict, type ExperimentRow, type Rate } from "@/lib/experiment-results";
import { createClient } from "@/lib/supabase/server";
import { REGION_LABELS, TOPIC_LABELS, isRegion, isTopic } from "@/lib/news-sources";
import { RefreshNews } from "./refresh-news";
import { getLeaderboard, MIN_USERS } from "@/lib/stranger-leaderboard";

export const metadata = { title: "Persona stats" };

const RANGES = [7, 30, 90];

export default function StatsPage({ searchParams }: { searchParams: Promise<{ days?: string; kind?: string; segment?: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading stats…</div>}>
      <Stats searchParams={searchParams} />
    </Suspense>
  );
}

async function Stats({ searchParams }: { searchParams: Promise<{ days?: string; kind?: string; segment?: string }> }) {
  await connection();
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  if (!(await isAdmin(db).catch(() => false))) notFound();

  const params = await searchParams;
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;
  const kind = params.kind === "checkin" ? "checkin" : "reply";
  const segment = params.segment && /^[a-z]+\.[a-z]+\.[a-z]+$/.test(params.segment) ? params.segment : undefined;
  const [{ replies, retention, experiments, news }, strangers] = await Promise.all([getStats(db, days), getLeaderboard(db, segment)]);
  const rows = replies.filter((r) => r.kind === kind);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-accent hover:underline">← Back to chats</Link>
            <Link href="/admin/strangers" className="text-accent hover:underline">Stranger Studio</Link>
          </div>
          <h1 className="mt-2 text-2xl font-semibold">Persona stats</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Counts and averages only, from reply metadata (no message text). Messages around a crisis are left out.
            Groups with fewer than 5 users show counts but no metrics.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Tabs param="days" value={String(days)} options={RANGES.map((d) => [String(d), `${d} days`])} other={{ kind }} />
          <Tabs param="kind" value={kind} options={[["reply", "Replies"], ["checkin", "Check-ins"]]} other={{ days: String(days) }} />
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Experiments</h2>
      <p className="mt-1 text-sm text-muted">
        New persona chats are split at random between variants (defined in <code>src/lib/experiments.ts</code>). Whole experiment,
        not limited to the date range. Ranges are 95% confidence; a difference counts as clear at p &lt; 0.05 with 20+ samples each.
      </p>
      {EXPERIMENTS.map((e) => (
        <ExperimentCard key={e.id} experiment={e} rows={experiments.find((x) => x.id === e.id)?.rows ?? null} />
      ))}

      <h2 className="mt-10 text-lg font-semibold">{kind === "checkin" ? "Check-ins" : "Replies"} by persona and model</h2>
      <p className="mt-1 text-sm text-muted">
        <b>Thumbs up</b> and <b>day-7 return</b> are the main measures. A reply counts as answered if the user texted back within 24 hours.
      </p>
      <Table
        empty="No replies with stats yet. Stats start from the first reply after this update."
        head={["Persona", "Model", "Users", "Replies", "Thumbs up", "Top 👎 reason", "Answered", "Median time to answer", "User words", "Words", "Bubbles", "Emoji", "Asks a question", "Latency"]}
        rows={rows.map((r) => [
          r.persona_name ?? "Deleted persona",
          modelName(r.model),
          r.users,
          r.replies,
          thumbs(r),
          r.top_down_reason ? REASON_LABELS[r.top_down_reason] : "–",
          pct(r.reply_rate),
          duration(r.median_reply_seconds),
          num(r.avg_user_words),
          num(r.avg_words),
          num(r.avg_bubbles),
          num(r.avg_emoji),
          pct(r.question_rate),
          r.median_latency_ms == null ? "–" : `${(r.median_latency_ms / 1000).toFixed(1)}s`,
        ])}
        dim={rows.map((r) => !r.enough_data)}
      />

      <h2 className="mt-10 text-lg font-semibold">Strangers</h2>
      {!strangers ? (
        <p className="mt-2 text-sm text-muted">Run the latest supabase/schema.sql (v8–v10) to see how strangers do.</p>
      ) : (
        <>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Score = how often people answer the first message (40%), reach 10+ messages (30%) and come back on a later day (30%); blocks count
            as 0. Smoothed, with a 95% range. New strangers are matched to users 20% of the time so they collect data. Rates show once {MIN_USERS}+ people
            have met them. Manage them in the <Link href="/admin/strangers" className="text-accent hover:underline">Stranger Studio</Link>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href={`?${new URLSearchParams({ days: String(days), kind })}`}
              className={`rounded-full border px-3 py-1 ${!segment ? "border-accent bg-accent text-white" : "border-border hover:border-accent"}`}>All users</Link>
            {strangers.segments.map((g) => (
              <Link key={g} href={`?${new URLSearchParams({ days: String(days), kind, segment: g })}`}
                className={`rounded-full border px-3 py-1 ${segment === g ? "border-accent bg-accent text-white" : "border-border hover:border-accent"}`}>
                {g.split(".").join(" · ")}
              </Link>
            ))}
          </div>
          {strangers.warnings.map((w) => (
            <p key={w} className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">⚠️ {w}</p>
          ))}
          <Table
            empty="No approved strangers yet."
            head={["Stranger", "Status", "Who", "Written by", "People", "Contacts", "Score", "Answered", "10+ messages", "Came back", "Blocked", "👍 / 👎", "Suggestion"]}
            rows={strangers.board.map((r) => [
              r.name,
              r.status,
              `${r.gender}, ${r.age_band}, ${r.city}`,
              r.generated_by,
              r.users,
              r.contacts,
              r.score === null ? "–" : `${Math.round(r.score * 100)} (${Math.round((r.low ?? 0) * 100)}–${Math.round((r.high ?? 0) * 100)})`,
              pct(r.answered),
              pct(r.reached10),
              pct(r.returned),
              r.blocked,
              r.score === null ? "–" : `${r.thumbs.up} / ${r.thumbs.down}`,
              r.suggestion ?? "",
            ])}
            dim={strangers.board.map((r) => r.score === null)}
          />
          {strangers.generators.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold">By the model that wrote them</h3>
              <p className="mt-1 text-xs text-muted">All of each model&apos;s approved strangers pooled together{segment ? ", for this group" : ""}.</p>
              <Table
                empty=""
                head={["Written by", "Strangers", "People", "Score"]}
                rows={strangers.generators.map((g) => [
                  g.generated_by,
                  g.strangers,
                  g.users,
                  g.score === null ? "–" : `${Math.round(g.score * 100)} (${Math.round((g.low ?? 0) * 100)}–${Math.round((g.high ?? 0) * 100)})`,
                ])}
                dim={strangers.generators.map((g) => g.score === null)}
              />
            </>
          )}
        </>
      )}

      <h2 className="mt-10 text-lg font-semibold">News</h2>
      {!news ? (
        <p className="mt-2 text-sm text-muted">Run the latest supabase/schema.sql (v7) to turn on the news feed.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            {news.configured ? "" : "NEWS_INGEST_KEY isn't set on the server, so the digest can't refresh. "}
            Digest: {news.items} stories from the last 48 hours ({news.sensitive} serious ones that personas never raise themselves).
            Last refreshed {news.refreshedAt ? new Date(news.refreshedAt).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC" : "never"}.
          </p>
          <div className="mt-3"><RefreshNews /></div>
          <p className="mt-3 text-sm">
            <span className="text-muted">By region:</span> {news.byRegion.map(([k, n]) => `${isRegion(k) ? REGION_LABELS[k] : k} ${n}`).join(" · ") || "–"}
            <br />
            <span className="text-muted">By topic:</span> {news.byTopic.map(([k, n]) => `${isTopic(k) ? TOPIC_LABELS[k] : k} ${n}`).join(" · ") || "–"}
          </p>
          <Table
            empty="Personas haven't brought up any news yet."
            head={["Topic or region", "Users", "Times brought up", "User engaged"]}
            rows={news.engagement.map((r) => [
              `${r.dimension === "topic" ? "Topic" : "Region"}: ${r.dimension === "topic" && isTopic(r.value) ? TOPIC_LABELS[r.value] : isRegion(r.value) ? REGION_LABELS[r.value] : r.value}`,
              r.users,
              r.mentions,
              range(rate(r.engaged, r.decided)),
            ])}
            dim={news.engagement.map((r) => !r.enough_data)}
          />
        </>
      )}

      <h2 className="mt-10 text-lg font-semibold">Do people come back?</h2>
      <p className="mt-1 text-sm text-muted">
        Day 1: texted again 20–48 hours after their first chat. Day 7: texted again a week or more later. A session ends after 30 quiet minutes.
      </p>
      <Table
        empty="No conversations in this period."
        head={["Persona", "Users", "Day-1 return", "Day-7 return", "Sessions", "Messages per session"]}
        rows={retention.map((r: RetentionRow) => [
          r.persona_name ?? "Deleted persona",
          r.users,
          pct(r.returned_day1),
          pct(r.returned_day7),
          r.sessions,
          num(r.messages_per_session),
        ])}
        dim={retention.map((r) => !r.enough_data)}
      />
    </main>
  );
}

function ExperimentCard({ experiment, rows }: { experiment: (typeof EXPERIMENTS)[number]; rows: ExperimentRow[] | null }) {
  const byId = new Map((rows ?? []).map((r) => [r.variant, r]));
  const control = byId.get(experiment.variants[0].id);
  return (
    <section className="mt-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{experiment.id}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs ${experiment.active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-panel text-muted"}`}>
          {experiment.active ? "Running" : "Ended"}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">{experiment.description}</p>
      {rows === null ? (
        <p className="mt-3 text-sm text-muted">Run the latest supabase/schema.sql (v5) to start collecting results.</p>
      ) : (
        <>
          <Table
            empty="No chats in this experiment yet."
            head={["Variant", "What changes", "Users", "Chats", "Thumbs up", "Day-7 return", "Day-1 return", "Replies answered", "User msgs / chat", "Words", "Bubbles", "Top 👎 reason"]}
            rows={experiment.variants.map((v, i) => {
              const r = byId.get(v.id);
              const x = r ? rates(r) : null;
              return [
                i === 0 && v.id !== "control" ? `${v.id} (control)` : v.id,
                describeVariant(v),
                r?.users ?? 0,
                r?.conversations ?? 0,
                range(x?.thumbs ?? null),
                range(x?.day7 ?? null),
                range(x?.day1 ?? null),
                range(x?.answered ?? null),
                num(r?.user_messages_per_chat ?? null),
                num(r?.avg_words ?? null),
                num(r?.avg_bubbles ?? null),
                r?.top_down_reason ? REASON_LABELS[r.top_down_reason] : "–",
              ];
            })}
            dim={experiment.variants.map((v) => !byId.get(v.id)?.enough_data)}
          />
          <ul className="mt-3 space-y-1 text-sm">
            {experiment.variants.slice(1).map((v) => {
              const r = byId.get(v.id);
              const result = r ? verdict(control, r) : { status: "early" as const, findings: [] };
              return (
                <li key={v.id}>
                  <b>{v.id}</b> vs control:{" "}
                  {result.status === "early" && <span className="text-muted">too early to tell (needs 5+ users and 20+ samples per variant).</span>}
                  {result.status === "no-difference" && <span>no clear difference yet.</span>}
                  {result.status === "clear" &&
                    result.findings.map((f, i) => (
                      <span key={f.metric} className={f.better ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}>
                        {i > 0 ? "; " : ""}
                        {f.better ? "better" : "worse"} on {f.metric} ({f.diff > 0 ? "+" : ""}{Math.round(f.diff * 100)} pts){f.main ? "" : " (secondary)"}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function range(r: Rate) {
  if (!r) return "–";
  return `${Math.round(r.rate * 100)}% (${Math.round(r.low * 100)}–${Math.round(r.high * 100)}%, n=${r.n})`;
}

function Tabs({ param, value, options, other }: { param: string; value: string; options: string[][]; other: Record<string, string> }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-border">
      {options.map(([v, label]) => (
        <Link key={v} href={`?${new URLSearchParams({ ...other, [param]: v })}`}
          className={`px-3 py-1.5 ${v === value ? "bg-accent text-white" : "hover:bg-panel"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
}

function Table({ head, rows, dim, empty }: { head: string[]; rows: (string | number)[][]; dim: boolean[]; empty: string }) {
  if (!rows.length) return <p className="mt-4 rounded-2xl border border-border p-6 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-panel text-left text-xs text-muted">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t border-border" title={dim[i] ? "Fewer than 5 users: metrics hidden" : undefined}>
              {cells.map((c, j) => (
                <td key={j} className={`whitespace-nowrap px-3 py-2 ${j > 1 ? "tabular-nums" : ""} ${dim[i] && j > 3 ? "text-muted" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const pct = (x: number | null) => (x == null ? "–" : `${Math.round(x * 100)}%`);
const num = (x: number | null) => (x == null ? "–" : String(x));
const modelName = (id: string | null) => (id && isModelId(id) ? getModel(id).name : (id ?? "–"));
function duration(s: number | null) {
  if (s == null) return "–";
  if (s < 90) return `${Math.round(s)}s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}
function thumbs(r: PersonaStatsRow) {
  if (r.thumbs_up == null || r.thumbs_down == null) return "–";
  const total = r.thumbs_up + r.thumbs_down;
  return total ? `${Math.round((r.thumbs_up / total) * 100)}% (${total})` : "no ratings";
}
