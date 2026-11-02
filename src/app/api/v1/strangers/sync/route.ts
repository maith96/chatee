import { authenticate, json, preflight, readJson, route } from "@/lib/api";
import { deliverIfDue, listContacts } from "@/lib/stranger-contacts";

export const maxDuration = 60;

/**
 * POST /api/v1/strangers/sync  { "timezone": "Africa/Nairobi" }
 * Call when the app opens. If a stranger is due to text the user (max one a day, never at night,
 * stops after two are left unanswered), their first message is created. Returns all the user's strangers:
 * `state: "request"` ones belong in a "Message requests" list until the user replies.
 */
export const POST = route(async (req) => {
  const { db, user } = await authenticate(req);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : undefined;
  const { delivered } = await deliverIfDue(db, user, timezone).catch((err) => {
    console.error("Stranger delivery failed", err);
    return { delivered: null };
  });
  return json(req, { delivered, contacts: (await listContacts(db, user.id)) ?? [] });
});

export const OPTIONS = preflight;
