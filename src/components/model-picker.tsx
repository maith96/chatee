"use client";

import { useEffect, useRef, useState } from "react";
import { getModel, type ModelId, type ModelInfo } from "@/lib/models";

export function ModelPicker({
  value,
  models,
  onChange,
}: {
  value: ModelId;
  models: ModelInfo[];
  onChange: (id: ModelId) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`Model: ${getModel(value).name}`} title={getModel(value).name}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface shadow-sm sm:h-auto sm:w-auto sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-2">
        {/* Small screens: just a settings icon. Larger: the model name. */}
        <svg className="h-5 w-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" />
        </svg>
        <span className="hidden h-2 w-2 rounded-full bg-emerald-500 sm:block" />
        <span className="hidden sm:inline">{getModel(value).name}</span>
        <span className="hidden text-muted sm:inline">▾</span>
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-10 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-surface p-2 shadow-lg">
          <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-widest text-muted sm:hidden">Model</li>
          {models.length === 0 && <li className="px-3 py-2 text-sm text-muted">No models configured.</li>}
          {models.map((m) => (
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
