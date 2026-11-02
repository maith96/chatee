"use client";

import { useEffect, useState } from "react";
import type { PersonaSummary } from "@/lib/personas";
import { Avatar } from "./avatar";

type Memory = { id: string; content: string; created_at: string };
type Data = {
  about_you: Memory[];
  about_them: Memory[];
  relationship: { stage: string; label: string; messages: number; since: string | null };
};
type Style = { personalize: boolean; adjustments: { id: string; label: string; because: string }[] };

/** Shows what a persona remembers about the user, with controls to forget things. */
export function MemoryPanel({ persona, onClose }: { persona: PersonaSummary; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<Style | null>(null);

  useEffect(() => {
    fetch(`/api/v1/personas/${persona.id}/style`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setStyle)
      .catch(() => {});
  }, [persona.id]);

  async function resetStyle() {
    await fetch(`/api/v1/personas/${persona.id}/style`, { method: "DELETE" });
    setStyle((s) => s && { ...s, adjustments: [] });
  }

  async function togglePersonalize(on: boolean) {
    setStyle((s) => s && { ...s, personalize: on, adjustments: on ? s.adjustments : [] });
    await fetch("/api/v1/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personalize: on }) });
    if (on) {
      const res = await fetch(`/api/v1/personas/${persona.id}/style`);
      if (res.ok) setStyle(await res.json());
    }
  }

  useEffect(() => {
    fetch(`/api/v1/personas/${persona.id}/memories`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't load memories.");
        setData(body);
      })
      .catch((e: Error) => setError(e.message));
  }, [persona.id]);

  async function forget(id: string) {
    await fetch(`/api/v1/memories/${id}`, { method: "DELETE" });
    setData((d) => d && { ...d, about_you: d.about_you.filter((m) => m.id !== id), about_them: d.about_them.filter((m) => m.id !== id) });
  }

  async function forgetAll() {
    if (!window.confirm(`Make ${persona.name} forget everything about you? This can't be undone.`)) return;
    await fetch(`/api/v1/personas/${persona.id}/memories`, { method: "DELETE" });
    setData((d) => d && { ...d, about_you: [], about_them: [] });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-label={`What ${persona.name} remembers`}
        className="flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-panel p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <Avatar persona={persona} />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">What {persona.name} remembers</div>
            {data && <div className="text-xs text-muted">{data.relationship.label} · {data.relationship.messages} messages</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-muted hover:bg-surface">✕</button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!data && !error && <p className="text-sm text-muted">Loading…</p>}
        {data && (
          <>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">About you</h3>
            {data.about_you.length === 0 ? (
              <p className="mb-4 text-sm text-muted">Nothing yet. {persona.name} picks up things you share as you chat.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {data.about_you.map((m) => (
                  <li key={m.id} className="group flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                    <span className="flex-1">{m.content}</span>
                    <button onClick={() => forget(m.id)} aria-label="Forget this" title="Forget this"
                      className="text-muted hover:text-red-500">✕</button>
                  </li>
                ))}
              </ul>
            )}
            {data.about_them.length > 0 && (
              <details className="mb-4">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-muted">
                  Things {persona.name} has said about themselves ({data.about_them.length})
                </summary>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {data.about_them.map((m) => <li key={m.id}>• {m.content}</li>)}
                </ul>
              </details>
            )}
            {style && (
              <section className="mb-4" aria-label="Your style">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">How {persona.name} adapts to you</h3>
                {!style.personalize ? (
                  <p className="text-sm text-muted">Off. {persona.name} texts in their usual style.</p>
                ) : style.adjustments.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nothing yet. {persona.name} adjusts their style (like reply length or emoji) from your 👍/👎 and how you text.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {style.adjustments.map((a) => (
                      <li key={a.id} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                        <div className="font-medium">{a.label}</div>
                        <div className="text-xs text-muted">{a.because}</div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={style.personalize} onChange={(e) => togglePersonalize(e.target.checked)} className="accent-[var(--accent)]" />
                    Adapt to my style
                  </label>
                  {style.personalize && style.adjustments.length > 0 && (
                    <button onClick={resetStyle} className="text-accent hover:underline">Reset</button>
                  )}
                </div>
                {!style.personalize && <p className="mt-1 text-xs text-muted">Applies to all personas.</p>}
              </section>
            )}
            <p className="mt-auto text-xs text-muted">Only you can see this. Memories are private to you and {persona.name}.</p>
            {(data.about_you.length > 0 || data.about_them.length > 0) && (
              <button onClick={forgetAll} className="mt-3 rounded-xl border border-border px-3 py-2 text-sm text-red-500 hover:bg-surface">
                Forget everything
              </button>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
