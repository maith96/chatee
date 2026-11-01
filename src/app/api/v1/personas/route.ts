import { authenticate, json, preflight, route } from "@/lib/api";
import { listPersonas, summarize } from "@/lib/personas";

// GET /api/v1/personas — built-in and public personas, plus your own.
export const GET = route(async (req) => {
  const { db, user } = await authenticate(req);
  const personas = await listPersonas(db, user.id);
  return json(req, { personas: personas.map((p) => summarize(p, user.id)) });
});
export const OPTIONS = preflight;
