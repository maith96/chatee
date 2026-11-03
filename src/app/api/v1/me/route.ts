import { authenticate, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
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

// DELETE /api/v1/me  { "confirm": "DELETE" }
// Permanently deletes the account and everything in it (chats, memories, settings). Can't be undone.
export const DELETE = route(async (req) => {
  const { db } = await authenticate(req, { requireAdult: false });
  const body = await readJson(req);
  if (body.confirm !== "DELETE") throw errors.badRequest('Send { "confirm": "DELETE" } to delete the account.');
  const { error } = await db.rpc("delete_my_account");
  if (error && (isMissingSchema(error) || error.code === "PGRST202")) throw new Error("Account deletion isn't set up yet: run supabase/schema.sql.");
  if (error) throw error;
  await db.auth.signOut().catch(() => {}); // the session belongs to a deleted user; clear its cookies
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
