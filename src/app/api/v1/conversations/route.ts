import { assertUuid, authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { getPersona } from "@/lib/personas";
import { createConversation, listConversations } from "@/lib/chat-service";
import { isModelAvailable } from "@/lib/providers";
import { isModelId, type ModelId } from "@/lib/models";

// GET /api/v1/conversations?limit=50 — newest first.
export const GET = route(async (req) => {
  const { db } = await authenticate(req);
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 50, 1), 100);
  return json(req, { conversations: await listConversations(db, limit) });
});

// POST /api/v1/conversations  { "persona_id"?: uuid, "title"?: string, "model"?: string }
// Without "model", the persona's preferred model is used (if available).
export const POST = route(async (req) => {
  const { db } = await authenticate(req);
  const body = await readJson(req);
  if (body.title !== undefined && typeof body.title !== "string") throw errors.badRequest("'title' must be a string.");
  if (body.model !== undefined && (!isModelId(body.model) || !isModelAvailable(body.model))) throw errors.badRequest("Unknown or unavailable 'model'. See GET /api/v1/models.");
  let persona = null;
  let model = body.model as ModelId | undefined;
  if (body.persona_id !== undefined && body.persona_id !== null) {
    if (typeof body.persona_id !== "string") throw errors.badRequest("'persona_id' must be a string.");
    assertUuid(body.persona_id, "Persona");
    persona = await getPersona(db, body.persona_id); // RLS: only personas you can see
    if (!persona) throw errors.notFound("Persona");
    const preferred = persona.definition.settings?.model;
    if (!model && isModelId(preferred) && isModelAvailable(preferred)) model = preferred;
  }
  const conversation = await createConversation(db, {
    title: (body.title as string | undefined)?.slice(0, 120),
    model,
    persona,
    modelChosen: body.model !== undefined,
  });
  return json(req, { conversation }, 201);
});

export const OPTIONS = preflight;
