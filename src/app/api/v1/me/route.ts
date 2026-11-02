import { authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { isAdultConfirmed } from "@/lib/age";
import { setPersonalize } from "@/lib/personalize";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchema } from "@/lib/db-errors";

async function personalizeSetting(db: SupabaseClient) {
  const { data, error } = await db.from("profiles").select("personalize").maybeSingle();
  if (error && isMissingSchema(error)) return true;
  if (error) throw error;
  return (data?.personalize as boolean | undefined) ?? true;
}

// GET /api/v1/me — who is signed in, whether they've confirmed they're 18+, and their settings.
export const GET = route(async (req) => {
  const { db, user } = await authenticate(req, { requireAdult: false });
  return json(req, {
    user: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      adult_confirmed: await isAdultConfirmed(db, user),
      personalize: await personalizeSetting(db),
    },
  });
});

// PATCH /api/v1/me  { "personalize": boolean } — let personas adapt their style to you (default on).
export const PATCH = route(async (req) => {
  const { db, user } = await authenticate(req);
  const body = await readJson(req);
  if (typeof body.personalize !== "boolean") throw errors.badRequest("'personalize' must be true or false.");
  await setPersonalize(db, user.id, body.personalize);
  return json(req, { user: { id: user.id, personalize: body.personalize } });
});

export const OPTIONS = preflight;
