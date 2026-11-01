"use client";

import { useActionState } from "react";
import { confirmAge, signOut, type AuthState } from "@/app/login/actions";
import { Logo } from "./logo";

export function AgeGate() {
  const [state, action, pending] = useActionState<AuthState, FormData>(confirmAge, {});
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-panel p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <span className="text-xl font-semibold">Persona</span>
        </div>
        <h1 className="mb-1 text-lg font-semibold">One quick check</h1>
        <p className="mb-6 text-sm text-muted">
          Persona is for adults only. Enter your date of birth to continue. We only save that you confirmed, not the date.
        </p>
        <form action={action} className="space-y-3">
          <input name="birthdate" type="date" required max={new Date().toISOString().slice(0, 10)} aria-label="Date of birth"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent" />
          {state.error && <p className="text-sm text-red-500">{state.error}</p>}
          <button disabled={pending} className="w-full rounded-xl bg-accent py-3 font-medium text-white disabled:opacity-60">
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
        <form action={signOut}>
          <button className="mt-4 w-full text-sm text-muted hover:text-text">Sign out</button>
        </form>
      </div>
    </main>
  );
}
