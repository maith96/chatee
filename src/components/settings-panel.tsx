"use client";

import { useEffect, useState } from "react";
import { REGION_LABELS, REGIONS, TOPIC_LABELS, TOPICS, type Region, type Topic } from "@/lib/news-sources";

type Learned = { id: string; engagement: number; mentions: number };
type News = {
  enabled: boolean;
  regions: Region[];
  topics: Topic[];
  home_region: Region | null;
  learned: { topics: Learned[]; regions: Learned[] };
};

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
};

/** App-wide settings: news in chats (and what's been learned), and style adaptation. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [news, setNews] = useState<News | null>(null);
  const [personalize, setPersonalize] = useState<boolean | null>(null);
  const [strangers, setStrangers] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/me/news?timezone=${encodeURIComponent(timezone())}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't load settings.");
        setNews(body.news);
      })
      .catch((e: Error) => setError(e.message));
    fetch("/api/v1/me")
      .then((res) => res.json())
      .then((body) => {
        setPersonalize(body?.user?.personalize ?? true);
        setStrangers(body?.user?.strangers ?? true);
      })
      .catch(() => {});
  }, []);

  async function save(patch: { enabled?: boolean; regions?: Region[]; topics?: Topic[]; reset_learning?: boolean }) {
    // Show the change straight away; the server's answer then replaces it.
    const { reset_learning: _reset, ...local } = patch; // eslint-disable-line @typescript-eslint/no-unused-vars
    setNews((n) => (n ? { ...n, ...local } : n));
    const res = await fetch("/api/v1/me/news", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const body = await res.json();
    if (res.ok) setNews((n) => (n ? { ...body.news, home_region: n.home_region } : body.news));
    else setError(body?.error?.message ?? "Couldn't save.");
  }

  function toggle<T extends string>(list: T[], value: T) {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function saveStrangers(on: boolean) {
    setStrangers(on);
    await fetch("/api/v1/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ strangers: on }) });
  }

  async function savePersonalize(on: boolean) {
    setPersonalize(on);
    await fetch("/api/v1/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalize: on }) });
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs ${active ? "border-accent bg-accent text-white" : "border-border hover:border-accent"}`;
  const label = (kind: "topic" | "region", id: string) =>
    kind === "topic" ? (TOPIC_LABELS as Record<string, string>)[id] ?? id : (REGION_LABELS as Record<string, string>)[id] ?? id;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-label="Settings"
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <div className="flex-1 font-semibold">Settings</div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-muted hover:bg-surface">✕</button>
        </div>
        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <section aria-label="News in chats" className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">News in chats</h3>
          {!news ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={news.enabled} onChange={(e) => save({ enabled: e.target.checked })} className="accent-[var(--accent)]" />
                Personas can chat about today&apos;s news
              </label>
              {news.enabled && (
                <>
                  <p className="mt-3 text-sm font-medium">Regions</p>
                  <p className="text-xs text-muted">
                    {news.regions.length ? "Only these (plus big world stories)." : `Auto: world news${news.home_region ? ` + ${REGION_LABELS[news.home_region]}` : ""}, tuned to what you engage with.`}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button className={chip(!news.regions.length)} onClick={() => save({ regions: [] })}>Auto</button>
                    {REGIONS.map((r) => (
                      <button key={r} className={chip(news.regions.includes(r))} aria-pressed={news.regions.includes(r)}
                        onClick={() => save({ regions: toggle(news.regions, r) })}>
                        {REGION_LABELS[r]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-medium">Topics</p>
                  <p className="text-xs text-muted">{news.topics.length ? "Mostly these." : "Auto: tuned to what you engage with."}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button className={chip(!news.topics.length)} onClick={() => save({ topics: [] })}>Auto</button>
                    {TOPICS.filter((t) => t !== "other").map((t) => (
                      <button key={t} className={chip(news.topics.includes(t))} aria-pressed={news.topics.includes(t)}
                        onClick={() => save({ topics: toggle(news.topics, t) })}>
                        {TOPIC_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-medium">What we&apos;ve learned</p>
                  {news.learned.topics.length + news.learned.regions.length === 0 ? (
                    <p className="text-xs text-muted">Nothing yet. When a persona mentions a story, we note whether you chatted about it (never what you said).</p>
                  ) : (
                    <>
                      <ul className="mt-1 space-y-1 text-xs">
                        {[...news.learned.topics.map((l) => ["topic", l] as const), ...news.learned.regions.map((l) => ["region", l] as const)]
                          .sort((a, b) => b[1].engagement - a[1].engagement)
                          .slice(0, 6)
                          .map(([kind, l]) => (
                            <li key={kind + l.id} className="flex justify-between">
                              <span>{label(kind, l.id)}</span>
                              <span className="text-muted">{l.engagement >= 0.6 ? "you're into this" : l.engagement <= 0.4 ? "not so much" : "so-so"}</span>
                            </li>
                          ))}
                      </ul>
                      <button onClick={() => save({ reset_learning: true })} className="mt-2 text-sm text-accent hover:underline">Reset what&apos;s been learned</button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {strangers !== null && (
          <section aria-label="Strangers" className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Strangers</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={strangers} onChange={(e) => saveStrangers(e.target.checked)} className="accent-[var(--accent)]" />
              AI strangers can message me
            </label>
            <p className="mt-1 text-xs text-muted">At most one new person a day, never at night. You can still use “Meet someone new” anytime.</p>
          </section>
        )}

        {personalize !== null && (
          <section aria-label="Style">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Style</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={personalize} onChange={(e) => savePersonalize(e.target.checked)} className="accent-[var(--accent)]" />
              Personas adapt to my style
            </label>
            <p className="mt-1 text-xs text-muted">Like shorter replies or fewer emoji, from your 👍/👎 and how you text. See and reset it per persona in 🧠 Memory.</p>
          </section>
        )}
      </aside>
    </div>
  );
}
