"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { checkBirthdate, recordAdultConfirmation } from "@/lib/age";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

export async function authenticate(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const mode = form.get("mode") === "signup" ? "signup" : "signin";
  if (!email || password.length < 6) return { error: "Enter an email and a password of at least 6 characters." };

  const supabase = await createClient();
  if (mode === "signup") {
    const age = checkBirthdate(String(form.get("birthdate") ?? ""));
    if (!age.ok) return { error: age.message };
    const origin = (await headers()).get("origin") ?? "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        // Only the confirmation is kept, never the birthdate. Copied to profiles on first use.
        data: { adult_confirmed_at: new Date().toISOString() },
      },
    });
    if (error) return { error: error.message };
    if (!data.session) return { message: "Check your email to confirm your account, then sign in." };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  }
  redirect("/");
}

async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : "";
}

/**
 * "Continue with Google": Supabase sends the user to Google, then back to /auth/callback.
 * New Google accounts confirm they're 18+ (date of birth) on their first visit, like everyone else.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback`, queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Google sign-in isn't available right now.")}`);
  redirect(data.url);
}

/** One-time 18+ confirmation for accounts created before the age check existed. */
export async function confirmAge(_prev: AuthState, form: FormData): Promise<AuthState> {
  const age = checkBirthdate(String(form.get("birthdate") ?? ""));
  if (!age.ok) return { error: age.message };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await recordAdultConfirmation(supabase, data.user.id);
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
