"use client";

import { useActionState, useState } from "react";
import { Logo } from "@/components/logo";
import { authenticate, type AuthState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-panel p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Logo />
          <span className="text-xl font-semibold">Persona</span>
        </div>
        <h1 className="text-lg font-semibold mb-1">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted mb-6">Your chats are saved and synced across devices.</p>

        <form action={action} className="space-y-3">
          <input type="hidden" name="mode" value={mode} />
          <input name="email" type="email" required placeholder="you@example.com" autoComplete="email"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent" />
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-sm text-muted">Date of birth (you must be 18+)</span>
              <input name="birthdate" type="date" required max={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent" />
            </label>
          )}
          <input name="password" type="password" required minLength={6} placeholder="Password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent" />
          {state.error && <p className="text-sm text-red-500">{state.error}</p>}
          {state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
          <button disabled={pending}
            className="w-full rounded-xl bg-accent py-3 font-medium text-white disabled:opacity-60">
            {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-sm text-muted hover:text-text">
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
