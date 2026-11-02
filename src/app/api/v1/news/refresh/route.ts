import { authenticate, errors, json, preflight, route } from "@/lib/api";
import { isAdmin } from "@/lib/feedback";
import { refreshNewsIfStale } from "@/lib/news-digest";

export const maxDuration = 300;

// POST /api/v1/news/refresh — admin only: rebuild the shared news digest now.
export const POST = route(async (req) => {
  const { db } = await authenticate(req);
  if (!(await isAdmin(db))) throw errors.forbidden("Only admins can refresh the news.");
  if (!process.env.NEWS_INGEST_KEY) throw errors.badRequest("NEWS_INGEST_KEY isn't set on the server, so the news feed is off.");
  return json(req, await refreshNewsIfStale(db, { force: true }));
});

export const OPTIONS = preflight;
