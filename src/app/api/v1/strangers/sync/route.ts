import { authenticate, json, preflight, readJson, route } from "@/lib/api";
import { deliverIfDue, listContacts, strangersEnabled } from "@/lib/stranger-contacts";
import { followUpIfDue } from "@/lib/stranger-followups";

export const maxDuration = 60;

/**
 * POST /api/v1/strangers/sync  { "timezone": "Africa/Nairobi" }
 * Call when the app opens. If a new stranger is due to text the user (max one a day, fewer when they're
 * left unanswered, never at night), their first message is created. Otherwise a stranger the user has
 * talked to may follow up (max one a day). Returns all the user's strangers:
 * `state: "request"` ones belong in a "Message requests" list until the user replies.
 * `followed_up` is the conversation id that got a follow-up, if any.
 */
export const POST = route(async (req) => {
  const { db, user } = await authenticate(req);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : undefined;
  const { delivered } = await deliverIfDue(db, user, timezone).catch((err) => {
    console.error("Stranger delivery failed", err);
    return { delivered: null };
  });
  // Never two stranger messages in one go: a follow-up only when no new stranger wrote.
  const followedUp = delivered || !(await strangersEnabled(db))
    ? null
    : await followUpIfDue(db, timezone).catch((err) => {
        console.error("Stranger follow-up failed", err);
        return null;
      });
  return json(req, { delivered, followed_up: followedUp, contacts: (await listContacts(db, user.id)) ?? [] });
});

export const OPTIONS = preflight;
