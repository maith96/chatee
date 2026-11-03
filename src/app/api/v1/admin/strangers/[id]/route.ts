import { assertUuid, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { FOLLOW_UP_PACE_IDS, isFollowUpPace, isOpeningStyle, OPENING_STYLE_IDS } from "@/lib/opening-styles";
import { deleteStranger, getStranger, setStatus, setStrangerTags, STRANGER_STATUSES, type StrangerStatus } from "@/lib/strangers";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const stranger = await getStranger(db, id);
  if (!stranger) throw errors.notFound("Stranger");
  return json(req, { stranger });
});

// PATCH /api/v1/admin/strangers/{id}  { "status"?: "trial" | "active" | "retired" | "draft", "opening_style"?: "shy" | ..., "follow_up_pace"?: "eager" | "steady" | "reserved" }
export const PATCH = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Stranger");
  const { db } = await authenticateAdmin(req);
  const body = await readJson(req);
  if (body.status === undefined && body.opening_style === undefined && body.follow_up_pace === undefined) throw errors.badRequest("Send 'status', 'opening_style' or 'follow_up_pace'.");
  let stranger;
  if (body.opening_style !== undefined || body.follow_up_pace !== undefined) {
    if (body.opening_style !== undefined && !isOpeningStyle(body.opening_style)) throw errors.badRequest(`'opening_style' must be one of: ${OPENING_STYLE_IDS.join(", ")}.`);
    if (body.follow_up_pace !== undefined && !isFollowUpPace(body.follow_up_pace)) throw errors.badRequest(`'follow_up_pace' must be one of: ${FOLLOW_UP_PACE_IDS.join(", ")}.`);
    stranger = await setStrangerTags(db, id, {
      ...(body.opening_style !== undefined ? { opening_style: body.opening_style } : {}),
      ...(body.follow_up_pace !== undefined ? { follow_up_pace: body.follow_up_pace } : {}),
    });
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
