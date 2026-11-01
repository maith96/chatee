"use client";

import { useEffect } from "react";
import type { PersonaSummary } from "@/lib/personas";
import { Avatar } from "./avatar";

/** A popup with a persona's public profile. Only the summary is shown, never the hidden character sheet. */
export function PersonaProfile({ persona, onClose }: { persona: PersonaSummary; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const facts = [persona.age ? `${persona.age}` : null, persona.pronouns].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${persona.name}'s profile`}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
        <button onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-accent-soft hover:text-text">✕</button>
        <div className="flex justify-center"><Avatar persona={persona} size="xl" /></div>
        <h2 className="mt-4 text-2xl font-semibold">{persona.name}</h2>
        {persona.tagline && <p className="mt-1 text-muted">{persona.tagline}</p>}
        {facts && <p className="mt-1 text-sm text-muted">{facts}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          {persona.role && <span className="rounded-full bg-accent-soft px-2.5 py-1 capitalize text-accent">{persona.role}</span>}
          {persona.is_romantic && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">romance</span>}
        </div>
        {persona.bio && <p className="mt-4 text-left text-sm">{persona.bio}</p>}
        {persona.interests.length > 0 && (
          <div className="mt-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Into</p>
            <div className="flex flex-wrap gap-2">
              {persona.interests.map((i) => (
                <span key={i} className="rounded-full border border-border px-3 py-1 text-sm">{i}</span>
              ))}
            </div>
          </div>
        )}
        <p className="mt-5 text-xs text-muted">{persona.name} is an AI character. Things they say aren&apos;t real facts.</p>
      </div>
    </div>
  );
}
