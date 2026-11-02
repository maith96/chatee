import { assertUuid, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { deleteStranger, getStranger, setStatus, STRANGER_STATUSES, type StrangerStatus } from "@/lib/strangers";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const stranger = await getStranger(db, id);
  if (!stranger) throw errors.notFound("Stranger");
  return json(req, { stranger });
});

// PATCH /api/v1/admin/strangers/{id}  { "status": "trial" | "active" | "retired" | "draft" }
export const PATCH = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const body = await readJson(req);
  if (!STRANGER_STATUSES.includes(body.status as StrangerStatus)) throw errors.badRequest(`'status' must be one of: ${STRANGER_STATUSES.join(", ")}.`);
  const result = await setStatus(db, id, body.status as StrangerStatus);
  if (result.error === "not_found") throw errors.notFound("Stranger");
  if (result.error === "needs_photo") throw errors.badRequest("Upload a main photo before approving.");
  return json(req, { stranger: result.stranger });
});

// DELETE /api/v1/admin/strangers/{id} — reject a draft (deletes it and its photos).
export const DELETE = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const s = await getStranger(db, id);
  if (!s) throw errors.notFound("Stranger");
  if (s.status !== "draft") throw errors.badRequest("Only drafts can be deleted. Retire it instead, so its chats keep working.");
  await deleteStranger(db, id);
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
