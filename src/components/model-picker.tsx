"use client";

import { useEffect, useRef, useState } from "react";
import { getModel, MODELS, type ModelId } from "@/lib/models";

export function ModelPicker({ value, onChange }: { value: ModelId; onChange: (id: ModelId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2 shadow-sm">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        {getModel(value).name}
        <span className="text-muted">▾</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-border bg-surface p-2 shadow-lg">
          {MODELS.map((m) => (
            <li key={m.id}>
              <button role="option" aria-selected={m.id === value}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={`w-full rounded-xl px-3 py-2 text-left hover:bg-accent-soft ${m.id === value ? "bg-accent-soft" : ""}`}>
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-muted">{m.description}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
