import { assertUuid, authenticate, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
import { clearFeedback, FEEDBACK_REASONS, isReason, setFeedback } from "@/lib/feedback";

type Params = { id: string };

/**
 * PUT /api/v1/replies/{reply_id}/feedback
 * Body: { "rating": 1 | -1, "reason"?: "too_long" | "too_short" | "out_of_character" | "repetitive" | "too_much" | "other" }
 * Rates a whole persona reply (all its bubbles share reply_id). Sending again changes the rating.
 */
export const PUT = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Reply");
  const { db, user } = await authenticate(req);
  const body = await readJson(req);
  if (body.rating !== 1 && body.rating !== -1) throw errors.badRequest("'rating' must be 1 or -1.");
  if (body.reason != null && !isReason(body.reason)) throw errors.badRequest(`'reason' must be one of: ${FEEDBACK_REASONS.join(", ")}.`);
  const feedback = await setFeedback(db, user.id, id, { rating: body.rating, reason: isReason(body.reason) ? body.reason : null });
  if (!feedback) throw errors.notFound("Reply");
  return json(req, { feedback });
});

// DELETE /api/v1/replies/{reply_id}/feedback — undo a rating.
export const DELETE = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Reply");
  const { db } = await authenticate(req);
  await clearFeedback(db, id);
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
