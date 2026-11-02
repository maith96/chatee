import { ApiError, authenticate, json, preflight, readJson, route } from "@/lib/api";
import { meetSomeone } from "@/lib/stranger-contacts";

export const maxDuration = 60;

// POST /api/v1/strangers/meet  { "timezone"?: "..." } — start a chat with a new random stranger, who says hi first.
export const POST = route(async (req) => {
  const { db } = await authenticate(req);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  const r = await meetSomeone(db, typeof body.timezone === "string" ? body.timezone.slice(0, 64) : undefined);
  if ("error" in r) {
    if (r.error === "limit") throw new ApiError(429, "limit_reached", "You've met 5 new people today. Come back tomorrow for more.");
    throw new ApiError(404, "no_strangers", "No new people to meet right now. Check back soon.");
  }
  return json(req, { conversation: r.conversation }, 201);
});

export const OPTIONS = preflight;
