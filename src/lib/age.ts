// 18+ checks. We only ever store *when* a user confirmed, never their birthdate.
import type { SupabaseClient, User } from "@supabase/supabase-js";

export const MIN_AGE = 18;

/** Parses YYYY-MM-DD and returns the age in whole years, or null if the date is invalid. */
export function ageFromBirthdate(birthdate: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (date > now || y < now.getUTCFullYear() - 120) return null;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() < mo - 1 || (now.getUTCMonth() === mo - 1 && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age;
}

export type AgeCheck = { ok: true } | { ok: false; message: string };

export function checkBirthdate(birthdate: string): AgeCheck {
  const age = ageFromBirthdate(birthdate);
  if (age === null) return { ok: false, message: "Enter a valid date of birth." };
  if (age < MIN_AGE) return { ok: false, message: "Sorry, you must be 18 or older to use Persona." };
  return { ok: true };
}

/**
 * Whether this user has confirmed they're 18+. Sign-up stores the confirmation in the user's
 * metadata (there's no session yet when email confirmation is on), so the first check copies it
 * into the profiles table.
 */
export async function isAdultConfirmed(db: SupabaseClient, user: User): Promise<boolean> {
  const { data, error } = await db.from("profiles").select("adult_confirmed_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (data?.adult_confirmed_at) return true;
  const fromSignup = user.user_metadata?.adult_confirmed_at;
  if (typeof fromSignup === "string") {
    await recordAdultConfirmation(db, user.id, fromSignup);
    return true;
  }
  return false;
}

export async function recordAdultConfirmation(db: SupabaseClient, userId: string, at = new Date().toISOString()) {
  const { error } = await db.from("profiles").upsert({ user_id: userId, adult_confirmed_at: at });
  if (error) throw error;
}
