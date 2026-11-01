import { authenticate, json, preflight, route } from "@/lib/api";
import { isAdultConfirmed } from "@/lib/age";

// GET /api/v1/me — who is signed in, and whether they've confirmed they're 18+.
export const GET = route(async (req) => {
  const { db, user } = await authenticate(req, { requireAdult: false });
  return json(req, {
    user: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      adult_confirmed: await isAdultConfirmed(db, user),
    },
  });
});
export const OPTIONS = preflight;
