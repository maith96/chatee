import { assertUuid, authenticate, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
import { deleteConversation, getConversation, listMessages, updateConversation } from "@/lib/chat-service";
import { isModelId, type ModelId } from "@/lib/models";

type Params = { id: string };

// GET /api/v1/conversations/{id} — the conversation plus all its messages.
export const GET = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id);
  const { db } = await authenticate(req);
  const conversation = await getConversation(db, id);
  if (!conversation) throw errors.notFound("Conversation");
  return json(req, { conversation, messages: await listMessages(db, id) });
});

// PATCH /api/v1/conversations/{id}  { "title"?: string, "model"?: string }
export const PATCH = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id);
  const { db } = await authenticate(req);
  const body = await readJson(req);
  const patch: { title?: string; model?: ModelId } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) throw errors.badRequest("'title' must be a non-empty string.");
    patch.title = body.title.trim().slice(0, 120);
  }
  if (body.model !== undefined) {
    if (!isModelId(body.model)) throw errors.badRequest("Unknown 'model'. See GET /api/v1/models.");
    patch.model = body.model;
  }
  if (!Object.keys(patch).length) throw errors.badRequest("Nothing to update. Send 'title' and/or 'model'.");
  const conversation = await updateConversation(db, id, patch);
  if (!conversation) throw errors.notFound("Conversation");
  return json(req, { conversation });
});

// DELETE /api/v1/conversations/{id}
export const DELETE = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id);
  const { db } = await authenticate(req);
  if (!(await deleteConversation(db, id))) throw errors.notFound("Conversation");
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
