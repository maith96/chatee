import { assertUuid, authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { CONTACT_STATES, setContactState, type ContactState } from "@/lib/stranger-contacts";

// PATCH /api/v1/strangers/{persona_id}  { "state": "accepted" | "ignored" | "blocked" }
// Ignore hides a message request; block also stops that stranger for good.
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticate(req);
  const body = await readJson(req);
  if (!CONTACT_STATES.includes(body.state as ContactState) || body.state === "request") throw errors.badRequest("'state' must be accepted, ignored or blocked.");
  const contact = await setContactState(db, id, body.state as ContactState);
  if (!contact) throw errors.notFound("Stranger");
  return json(req, { contact });
});

export const OPTIONS = preflight;
