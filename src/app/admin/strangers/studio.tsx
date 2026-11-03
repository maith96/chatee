"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { FOLLOW_UP_PACE_IDS, FOLLOW_UP_PACES, OPENING_STYLE_IDS, OPENING_STYLES, type FollowUpPace, type OpeningStyle } from "@/lib/opening-styles";
import type { Stranger, StrangerStatus } from "@/lib/strangers";

// Suggestions for "written by" (anything is accepted).
const GENERATORS = ["Claude Sonnet 5.5", "Claude Opus 5.5", "ChatGPT", "Grok", "Gemini"];
const GEN_KEY = "studio.generatedBy";
const noSubscribe = () => () => {};
function savedGenerator() {
  try {
    return localStorage.getItem(GEN_KEY) || GENERATORS[0];
  } catch {
    return GENERATORS[0];
  }
}

const TABS: { id: StrangerStatus; label: string }[] = [
  { id: "draft", label: "Drafts" },
  { id: "trial", label: "Trial" },
  { id: "active", label: "Active" },
  { id: "retired", label: "Retired" },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1/admin/strangers${path}`, init);
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? "Something went wrong.");
  return body as T;
}

/** Shrinks a photo in the browser (max 1024px, WebP) so uploads are small and fast. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.86));
  return blob ?? file;
}

export function StrangerStudio() {
  const [tab, setTab] = useState<StrangerStatus>("draft");
  const [items, setItems] = useState<Stranger[] | null>(null);
  const [counts, setCounts] = useState<Record<StrangerStatus, number> | null>(null);
  const [count, setCount] = useState(5);
  const [drafting, setDrafting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [template, setTemplate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState("");
  // The last "written by" used in this browser (read without a hydration mismatch); null until edited.
  const saved = useSyncExternalStore(noSubscribe, savedGenerator, () => GENERATORS[0]);
  const [edited, setGeneratedBy] = useState<string | null>(null);
  const generatedBy = edited ?? saved;
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const load = useCallback(async (status: StrangerStatus) => {
    try {
      const data = await api<{ strangers: Stranger[]; counts: Record<StrangerStatus, number> | null }>(`?status=${status}`);
      setItems(data.strangers);
      setCounts(data.counts);
    } catch (e) {
      setNotice((e as Error).message);
      setItems([]);
    }
  }, []);
  // Loading happens in an event-like callback after the tab changes.
  useEffect(() => {
    let cancelled = false;
    api<{ strangers: Stranger[]; counts: Record<StrangerStatus, number> | null }>(`?status=${tab}`)
      .then((d) => !cancelled && (setItems(d.strangers), setCounts(d.counts)))
      .catch((e: Error) => !cancelled && (setNotice(e.message), setItems([])));
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function draft() {
    setDrafting(true);
    setNotice(`Drafting ${count}… this takes about ${Math.ceil(count / 3) * 20} seconds.`);
    try {
      const r = await api<{ created: Stranger[]; failures: string[] }>("", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      setNotice(`Drafted ${r.created.length}${r.failures.length ? `, ${r.failures.length} failed (try again)` : ""}.`);
      setTab("draft");
      await load("draft");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  async function getTemplate() {
    setImportNote(null);
    try {
      const r = await api<{ template: string }>(`/template?count=${count}`);
      setTemplate(r.template);
      setCopied(false);
    } catch (e) {
      setImportNote((e as Error).message);
    }
  }

  async function importReply() {
    setImporting(true);
    setImportNote(null);
    try {
      localStorage.setItem(GEN_KEY, generatedBy.trim());
    } catch {}
    try {
      const res = await fetch("/api/v1/admin/strangers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply, generated_by: generatedBy.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.created === undefined) throw new Error(body?.error?.message ?? "Something went wrong.");
      const r = body as { created: Stranger[]; failures: string[] };
      setImportNote(
        `Imported ${r.created.length} as drafts${r.failures.length ? `. Skipped ${r.failures.length}: ${r.failures.join("; ")}` : "."}`,
      );
      if (r.created.length) {
        setReply("");
        setTemplate(null);
        setTab("draft");
        await load("draft");
      }
    } catch (e) {
      setImportNote((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const replace = (s: Stranger) => setItems((xs) => (xs ?? []).map((x) => (x.id === s.id ? s : x)));
  const drop = (id: string) => setItems((xs) => (xs ?? []).filter((x) => x.id !== id));

  return (
    <>
      <section className="mt-6 rounded-2xl border border-border bg-panel p-4" aria-label="Draft with another model">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Draft strangers with another model</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="How many"
            className="rounded-lg border border-border bg-surface px-2 py-1 text-sm">
            {[1, 3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={getTemplate} className="rounded-xl bg-accent px-4 py-1.5 text-sm font-medium text-white">Get template</button>
        </div>
        <p className="mt-1 text-xs text-muted">
          1. Get the template and paste it into Claude, ChatGPT, Grok or any strong model. 2. Paste its whole reply below. 3. Import: they
          arrive as drafts, labelled with the model that wrote them. The template asks for people that fill gaps in the pool (gender, age,
          region) and lists the strangers you already have so it doesn&apos;t repeat them.
        </p>
        {template && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Template for {count} stranger{count > 1 ? "s" : ""}</span>
              <button onClick={() => navigator.clipboard?.writeText(template).then(() => setCopied(true)).catch(() => {})}
                className="rounded-lg border border-border px-2 py-0.5 text-xs hover:border-accent">{copied ? "Copied" : "Copy template"}</button>
            </div>
            <textarea readOnly value={template} rows={6} aria-label="Template"
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs" />
          </div>
        )}
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={5} aria-label="The model's reply"
          placeholder="Paste the model's reply (the JSON) here"
          className="mt-3 w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted" htmlFor="generated-by">Written by</label>
          <input id="generated-by" list="generators" value={generatedBy} onChange={(e) => setGeneratedBy(e.target.value)} maxLength={40}
            className="rounded-lg border border-border bg-surface px-2 py-1 text-sm" />
          <datalist id="generators">{GENERATORS.map((g) => <option key={g} value={g} />)}</datalist>
          <button onClick={importReply} disabled={importing || !reply.trim() || !generatedBy.trim()}
            className="rounded-xl bg-accent px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60">
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
        {importNote && <p className="mt-2 text-sm text-muted">{importNote}</p>}
      </section>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
        <span className="text-xs text-muted">Or draft {count} right here with Nova Smart (quicker, usually more generic):</span>
        <button onClick={draft} disabled={drafting} className="rounded-xl border border-border px-3 py-1 text-xs hover:border-accent disabled:opacity-60">
          {drafting ? "Drafting…" : "Draft with Nova"}
        </button>
        {notice && <span className="w-full text-sm text-muted">{notice}</span>}
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setItems(null); setTab(t.id); }}
            className={`rounded-full border px-4 py-1.5 text-sm ${tab === t.id ? "border-accent bg-accent text-white" : "border-border hover:border-accent"}`}>
            {t.label}{counts ? ` (${counts[t.id]})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {items === null && <p className="text-sm text-muted">Loading…</p>}
        {items?.length === 0 && <p className="rounded-2xl border border-border p-6 text-sm text-muted">Nothing here yet.</p>}
        {items?.map((s) => <StrangerCard key={s.id} s={s} onChange={replace} onGone={drop} onNotice={setNotice} />)}
      </div>
    </>
  );
}

function StrangerCard({ s, onChange, onGone, onNotice }: { s: Stranger; onChange: (s: Stranger) => void; onGone: (id: string) => void; onNotice: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const d = s.definition;
  const c = d.communication;
  const t = s.tags;

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      onNotice(`${s.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }
  const status = (next: StrangerStatus) =>
    act(next, async () => {
      const r = await api<{ stranger: Stranger }>(`/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      onGone(r.stranger.id); // it moves to another tab
      onNotice(`${s.name} → ${next}.`);
    });
  const setTags = (patch: { opening_style?: OpeningStyle; follow_up_pace?: FollowUpPace }) =>
    act("style", async () => {
      const r = await api<{ stranger: Stranger }>(`/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      onChange(r.stranger);
    });
  const upload = (slot: "main" | "gallery") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    act(`upload-${slot}`, async () => {
      const form = new FormData();
      form.append("file", new File([await shrink(file)], "photo.webp", { type: "image/webp" }));
      form.append("slot", slot);
      onChange((await api<{ stranger: Stranger }>(`/${s.id}/images`, { method: "POST", body: form })).stranger);
    });
  };
  const removePhoto = (url: string) =>
    act("remove", async () => {
      onChange((await api<{ stranger: Stranger }>(`/${s.id}/images`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })).stranger);
    });

  return (
    <article className="rounded-2xl border border-border bg-surface p-4" aria-label={s.name}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="shrink-0">
          <div className="relative h-36 w-36 overflow-hidden rounded-2xl bg-accent-soft">
            {s.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.avatar_url} alt={`${s.name}, main photo`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-muted">No main photo yet</div>
            )}
            {s.avatar_url && (
              <button onClick={() => removePhoto(s.avatar_url!)} aria-label="Remove main photo" className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white">✕</button>
            )}
          </div>
          <label className="mt-2 block cursor-pointer rounded-lg border border-border px-2 py-1 text-center text-xs hover:border-accent">
            {busy === "upload-main" ? "Uploading…" : s.avatar_url ? "Replace main photo" : "Upload main photo"}
            <input type="file" accept="image/*" className="hidden" onChange={upload("main")} />
          </label>
          <div className="mt-2 flex max-w-36 flex-wrap gap-1">
            {s.images.map((u) => (
              <div key={u} className="relative h-11 w-11 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button onClick={() => removePhoto(u)} aria-label="Remove photo" className="absolute right-0 top-0 bg-black/60 px-1 text-[10px] text-white">✕</button>
              </div>
            ))}
            <label className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-lg text-muted hover:border-accent" title="Add gallery photo">
              {busy === "upload-gallery" ? "…" : "+"}
              <input type="file" accept="image/*" className="hidden" onChange={upload("gallery")} />
            </label>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-lg font-semibold">{s.name}, {d.identity.age}</h2>
            <span className="text-sm text-muted">{t.city}, {t.country} · {t.job} · {t.gender}</span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted" title="Which AI wrote this stranger">by {t.generated_by ?? "nova-smart"}</span>
          </div>
          <p className="text-sm">{s.tagline}</p>
          <p className="mt-2 text-sm text-muted">{d.identity.bio}</p>
          <p className="mt-2 text-xs text-muted">
            <b>Vibe:</b> {t.vibe} · <b>Traits:</b> {d.personality.traits.join(", ")} · <b>Into:</b> {d.knowledge.interests.join(", ")}
          </p>
          <p className="mt-1 text-xs text-muted">
            <b>Texts:</b> {c.length}, {c.lowercase ? "lowercase" : "normal caps"}, emoji {c.emoji}, slang {c.slang}/2, up to {c.bubbles} bubble{c.bubbles > 1 ? "s" : ""}
          </p>
          <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <b>Says hi:</b>
            <select value={t.opening_style ?? "warm"} disabled={!!busy} onChange={(e) => setTags({ opening_style: e.target.value as OpeningStyle })}
              className="rounded-lg border border-border bg-surface px-2 py-0.5 text-xs text-text" aria-label={`${s.name}'s opening style`}>
              {OPENING_STYLE_IDS.map((id) => <option key={id} value={id}>{OPENING_STYLES[id].label}</option>)}
            </select>
            <span>{OPENING_STYLES[t.opening_style ?? "warm"].guide}</span>
          </label>
          <label className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <b>Follows up:</b>
            <select value={t.follow_up_pace ?? "steady"} disabled={!!busy} onChange={(e) => setTags({ follow_up_pace: e.target.value as FollowUpPace })}
              className="rounded-lg border border-border bg-surface px-2 py-0.5 text-xs text-text" aria-label={`${s.name}'s follow-up pace`}>
              {FOLLOW_UP_PACE_IDS.map((id) => <option key={id} value={id}>{FOLLOW_UP_PACES[id].label}</option>)}
            </select>
            <span>when a chat goes quiet (once, then waits for a reply)</span>
          </label>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-accent-ink">How they text, and first messages</summary>
            <ul className="mt-2 space-y-1">
              {c.examples.map((e, i) => (
                <li key={i}><span className="text-xs text-muted">{e.situation}:</span> {Array.isArray(e.text) ? e.text.join(" / ") : e.text}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs font-medium">Opening messages (ideas for review; their real first message is written fresh in their opening style)</p>
            <ul className="list-disc pl-5 text-sm">{t.openers.map((o, i) => <li key={i}>{o}</li>)}</ul>
          </details>
          {s.image_prompts && (
            <div className="mt-3 space-y-2">
              <Prompt label="Main photo prompt" text={s.image_prompts.base} />
              {s.image_prompts.variants.map((v, i) => <Prompt key={i} label={`Extra photo ${i + 1} (use the main photo as reference)`} text={v} />)}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {s.status === "draft" && (
              <>
                <button disabled={!!busy || !s.avatar_url} onClick={() => status("trial")} title={s.avatar_url ? "" : "Upload a main photo first"}
                  className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Approve → trial</button>
                <button disabled={!!busy} onClick={() => window.confirm(`Delete ${s.name}? This can't be undone.`) && act("delete", async () => { await api(`/${s.id}`, { method: "DELETE" }); onGone(s.id); })}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm text-red-500 hover:bg-panel">Reject</button>
              </>
            )}
            {s.status === "trial" && <button disabled={!!busy} onClick={() => status("active")} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white">Make active</button>}
            {(s.status === "trial" || s.status === "active") && <button disabled={!!busy} onClick={() => status("retired")} className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-panel">Retire</button>}
            {s.status === "retired" && <button disabled={!!busy} onClick={() => status("draft")} className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-panel">Back to drafts</button>}
          </div>
        </div>
      </div>
    </article>
  );
}

function Prompt({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-panel p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <button onClick={() => {
            navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
          }}
          className="rounded-lg border border-border px-2 py-0.5 text-xs hover:border-accent">{copied ? "Copied" : "Copy"}</button>
      </div>
      <p className="mt-1 text-xs text-muted">{text}</p>
    </div>
  );
}
