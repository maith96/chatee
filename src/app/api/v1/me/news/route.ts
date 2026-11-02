import { authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { newsOverview, setNewsPrefs } from "@/lib/news";
import { isRegion, isTopic } from "@/lib/news-sources";

// GET /api/v1/me/news?timezone=Africa/Nairobi — news settings and what's been learned about your interests.
export const GET = route(async (req) => {
  const { db } = await authenticate(req);
  const timezone = new URL(req.url).searchParams.get("timezone")?.slice(0, 64) ?? undefined;
  return json(req, { news: await newsOverview(db, timezone) });
});

/**
 * PATCH /api/v1/me/news
 * { "enabled"?: boolean, "regions"?: string[], "topics"?: string[], "reset_learning"?: true }
 * Empty regions/topics = choose automatically from your engagement.
 */
export const PATCH = route(async (req) => {
  const { db, user } = await authenticate(req);
  const body = await readJson(req);
  const patch: Parameters<typeof setNewsPrefs>[2] = {};
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") throw errors.badRequest("'enabled' must be true or false.");
    patch.enabled = body.enabled;
  }
  if (body.regions !== undefined) {
    if (!Array.isArray(body.regions) || !body.regions.every(isRegion)) throw errors.badRequest("'regions' must be a list of known regions.");
    patch.regions = [...new Set(body.regions)];
  }
  if (body.topics !== undefined) {
    if (!Array.isArray(body.topics) || !body.topics.every(isTopic)) throw errors.badRequest("'topics' must be a list of known topics.");
    patch.topics = [...new Set(body.topics)];
  }
  if (body.reset_learning === true) patch.reset = true;
  if (!Object.keys(patch).length) throw errors.badRequest("Nothing to update.");
  await setNewsPrefs(db, user.id, patch);
  return json(req, { news: await newsOverview(db) });
});

export const OPTIONS = preflight;
