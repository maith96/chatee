import { authenticate, json, preflight, route } from "@/lib/api";

// GET /api/v1/me — who is signed in.
export const GET = route(async (req) => {
  const { user } = await authenticate(req);
  return json(req, { user: { id: user.id, email: user.email ?? null, created_at: user.created_at } });
});
export const OPTIONS = preflight;
