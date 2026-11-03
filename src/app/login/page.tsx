"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo, Wordmark } from "@/components/logo";
import { authenticate, signInWithGoogle, type AuthState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate, {});
  const [googlePending, setGooglePending] = useState(false);

  return (
    <main className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-panel p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Logo />
          <Wordmark className="text-2xl" />
        </div>
        <h1 className="text-lg font-semibold mb-1">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted mb-6">Your chats are saved and synced across devices.</p>

        <form action={signInWithGoogle} onSubmit={() => setGooglePending(true)}>
          <button disabled={googlePending}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface py-3 font-medium hover:border-accent disabled:opacity-60">
            <GoogleLogo />
            {googlePending ? "Opening Google…" : "Continue with Google"}
          </button>
        </form>
        <Suspense>
          <RedirectError />
        </Suspense>
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" />
        </div>

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

/** Errors from the Google round trip arrive as ?error=... */
function RedirectError() {
  const error = useSearchParams().get("error");
  return error ? <p className="mt-3 text-sm text-red-500">{error.slice(0, 200)}</p> : null;
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
