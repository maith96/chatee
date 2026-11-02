import { authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { isAdultConfirmed } from "@/lib/age";
import { setPersonalize } from "@/lib/personalize";
import { setStrangersEnabled, strangersEnabled } from "@/lib/stranger-contacts";
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
      strangers: await strangersEnabled(db),
    },
  });
});

// PATCH /api/v1/me  { "personalize"?: boolean, "strangers"?: boolean }
// personalize: personas adapt their style to you. strangers: AI strangers may message you first. Both default on.
export const PATCH = route(async (req) => {
  const { db, user } = await authenticate(req);
  const body = await readJson(req);
  if (body.personalize === undefined && body.strangers === undefined) throw errors.badRequest("Send 'personalize' and/or 'strangers'.");
  if (body.personalize !== undefined && typeof body.personalize !== "boolean") throw errors.badRequest("'personalize' must be true or false.");
  if (body.strangers !== undefined && typeof body.strangers !== "boolean") throw errors.badRequest("'strangers' must be true or false.");
  if (typeof body.personalize === "boolean") await setPersonalize(db, user.id, body.personalize);
  if (typeof body.strangers === "boolean") await setStrangersEnabled(db, user.id, body.strangers);
  return json(req, { user: { id: user.id, personalize: body.personalize, strangers: body.strangers } });
});

export const OPTIONS = preflight;
