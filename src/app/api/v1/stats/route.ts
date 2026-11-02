import { authenticate, errors, json, preflight, route } from "@/lib/api";
import { getStats, isAdmin } from "@/lib/feedback";

// GET /api/v1/stats?days=30 — admin only. Aggregate persona metrics (no message text, no user ids).
export const GET = route(async (req) => {
  const { db } = await authenticate(req);
  if (!(await isAdmin(db))) throw errors.forbidden("Only admins can see stats.");
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  return json(req, { days, ...(await getStats(db, days)) });
});

export const OPTIONS = preflight;
