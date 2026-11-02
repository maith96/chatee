import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getStats, isAdmin, REASON_LABELS, type PersonaStatsRow, type RetentionRow } from "@/lib/feedback";
import { getModel, isModelId } from "@/lib/models";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Persona stats" };

const RANGES = [7, 30, 90];

export default function StatsPage({ searchParams }: { searchParams: Promise<{ days?: string; kind?: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading stats…</div>}>
      <Stats searchParams={searchParams} />
    </Suspense>
  );
}

async function Stats({ searchParams }: { searchParams: Promise<{ days?: string; kind?: string }> }) {
  await connection();
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  if (!(await isAdmin(db).catch(() => false))) notFound();

  const params = await searchParams;
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;
  const kind = params.kind === "checkin" ? "checkin" : "reply";
  const { replies, retention } = await getStats(db, days);
  const rows = replies.filter((r) => r.kind === kind);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-accent hover:underline">← Back to chats</Link>
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

      <h2 className="mt-8 text-lg font-semibold">{kind === "checkin" ? "Check-ins" : "Replies"} by persona and model</h2>
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
