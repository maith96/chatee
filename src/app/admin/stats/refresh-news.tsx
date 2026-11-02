"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Rebuilds the shared news digest now (admin). */
export function RefreshNews() {
  const router = useRouter();
  const [state, setState] = useState<string | null>(null);
  async function refresh() {
    setState("Refreshing… (fetching feeds and summarising, up to a minute)");
    const res = await fetch("/api/v1/news/refresh", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setState(body?.error?.message ?? "Refresh failed.");
    setState(body.status === "refreshed" ? `Done: ${body.items} stories from ${body.feeds} headlines.` : `Status: ${body.status}`);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button onClick={refresh} className="rounded-xl border border-border px-3 py-1.5 hover:bg-panel">Refresh now</button>
      {state && <span className="text-muted">{state}</span>}
    </div>
  );
}
