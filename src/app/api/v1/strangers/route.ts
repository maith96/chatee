import { authenticate, json, preflight, route } from "@/lib/api";
import { listContacts } from "@/lib/stranger-contacts";

// GET /api/v1/strangers — the strangers you've met (without sending a new one; see POST /strangers/sync).
export const GET = route(async (req) => {
  const { db, user } = await authenticate(req);
  return json(req, { contacts: (await listContacts(db, user.id)) ?? [] });
});

export const OPTIONS = preflight;
