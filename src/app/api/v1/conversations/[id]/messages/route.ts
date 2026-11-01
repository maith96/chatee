import { assertUuid, authenticate, corsHeaders, errors, json, preflight, readJson, route } from "@/lib/api";
import { friendlyError, getConversation, isRateLimited, MAX_MESSAGE_CHARS, startReply } from "@/lib/chat-service";
import { isModelAvailable } from "@/lib/providers";
import { isModelId, type ModelId } from "@/lib/models";

export const maxDuration = 60;

type Params = { id: string };

/**
 * POST /api/v1/conversations/{id}/messages
 * Body: { "content": string, "model"?: string, "stream"?: boolean }
 *
 * stream=false (default): waits, returns JSON { user_message, assistant_message }.
 * stream=true: returns the reply as a plain-text stream (chunked), easiest to consume from any app.
 */
export const POST = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id);
  const { db } = await authenticate(req);
  const body = await readJson(req);

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) throw errors.badRequest("'content' is required.");
  if (content.length > MAX_MESSAGE_CHARS) throw errors.badRequest(`'content' is longer than ${MAX_MESSAGE_CHARS} characters.`);
  if (body.model !== undefined && (!isModelId(body.model) || !isModelAvailable(body.model))) throw errors.badRequest("Unknown or unavailable 'model'. See GET /api/v1/models.");

  const conversation = await getConversation(db, id);
  if (!conversation) throw errors.notFound("Conversation");
  if (await isRateLimited(db)) throw errors.rateLimited();

  const { result, userMessage, saved, getError } = await startReply(db, {
    conversation,
    content,
    model: body.model as ModelId | undefined,
    abortSignal: req.signal,
  });

  if (body.stream === true) {
    return result.toTextStreamResponse({
      headers: { ...corsHeaders(req), "X-User-Message-Id": userMessage.id, "Cache-Control": "no-cache" },
    });
  }

  try {
    await result.text;
  } catch (err) {
    return json(req, { error: { code: "generation_failed", message: friendlyError(getError() ?? err) } }, 502);
  }
  const assistantMessage = await saved;
  if (!assistantMessage) {
    return json(req, { error: { code: "generation_failed", message: "The model returned an empty reply." } }, 502);
  }
  return json(req, { user_message: userMessage, assistant_message: assistantMessage }, 201);
});

export const OPTIONS = preflight;
