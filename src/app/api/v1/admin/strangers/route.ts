import { errors, json, preflight, readJson, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { createDrafts, listStrangers, STRANGER_STATUSES, strangerCounts, type StrangerStatus } from "@/lib/strangers";

export const maxDuration = 300;

// GET /api/v1/admin/strangers?status=draft — the pool, newest first, with counts per status.
export const GET = route(async (req) => {
  const { db } = await authenticateAdmin(req);
  const status = new URL(req.url).searchParams.get("status");
  if (status && !STRANGER_STATUSES.includes(status as StrangerStatus)) throw errors.badRequest("Unknown status.");
  const [strangers, counts] = await Promise.all([listStrangers(db, (status as StrangerStatus) || undefined), strangerCounts(db)]);
  return json(req, { strangers, counts });
});

// POST /api/v1/admin/strangers  { "count": 1-10 } — draft new strangers that fill gaps in the pool.
export const POST = route(async (req) => {
  const { db } = await authenticateAdmin(req);
  const body = await readJson(req);
  const count = Math.min(10, Math.max(1, Math.round(Number(body.count) || 5)));
  const { created, failures } = await createDrafts(db, count);
  return json(req, { created, failures }, created.length ? 201 : 502);
});

export const OPTIONS = preflight;
