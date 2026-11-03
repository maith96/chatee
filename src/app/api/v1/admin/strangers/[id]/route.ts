import { assertUuid, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { isOpeningStyle, OPENING_STYLE_IDS } from "@/lib/opening-styles";
import { deleteStranger, getStranger, setOpeningStyle, setStatus, STRANGER_STATUSES, type StrangerStatus } from "@/lib/strangers";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const stranger = await getStranger(db, id);
  if (!stranger) throw errors.notFound("Stranger");
  return json(req, { stranger });
});

// PATCH /api/v1/admin/strangers/{id}  { "status"?: "trial" | "active" | "retired" | "draft", "opening_style"?: "shy" | ... }
export const PATCH = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const body = await readJson(req);
  if (body.status === undefined && body.opening_style === undefined) throw errors.badRequest("Send 'status' or 'opening_style'.");
  let stranger;
  if (body.opening_style !== undefined) {
    if (!isOpeningStyle(body.opening_style)) throw errors.badRequest(`'opening_style' must be one of: ${OPENING_STYLE_IDS.join(", ")}.`);
    stranger = await setOpeningStyle(db, id, body.opening_style);
    if (!stranger) throw errors.notFound("Stranger");
  }
  if (body.status !== undefined) {
    if (!STRANGER_STATUSES.includes(body.status as StrangerStatus)) throw errors.badRequest(`'status' must be one of: ${STRANGER_STATUSES.join(", ")}.`);
    const result = await setStatus(db, id, body.status as StrangerStatus);
    if (result.error === "not_found") throw errors.notFound("Stranger");
    if (result.error === "needs_photo") throw errors.badRequest("Upload a main photo before approving.");
    stranger = result.stranger;
  }
  return json(req, { stranger });
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
