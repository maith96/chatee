import { authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { createConversation, listConversations } from "@/lib/chat-service";
import { isModelAvailable } from "@/lib/providers";
import { isModelId, type ModelId } from "@/lib/models";

// GET /api/v1/conversations?limit=50 — newest first.
export const GET = route(async (req) => {
  const { db } = await authenticate(req);
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 50, 1), 100);
  return json(req, { conversations: await listConversations(db, limit) });
});

// POST /api/v1/conversations  { "title"?: string, "model"?: "terra-fast" | ... }
export const POST = route(async (req) => {
  const { db } = await authenticate(req);
  const body = await readJson(req);
  if (body.title !== undefined && typeof body.title !== "string") throw errors.badRequest("'title' must be a string.");
  if (body.model !== undefined && (!isModelId(body.model) || !isModelAvailable(body.model))) throw errors.badRequest("Unknown or unavailable 'model'. See GET /api/v1/models.");
  const conversation = await createConversation(db, {
    title: (body.title as string | undefined)?.slice(0, 120),
    model: body.model as ModelId | undefined,
  });
  return json(req, { conversation }, 201);
});

export const OPTIONS = preflight;
