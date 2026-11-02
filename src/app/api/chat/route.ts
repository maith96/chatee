// Streaming endpoint for the website's chat UI (AI SDK UI-message protocol for useChat).
// Other apps should use /api/v1/conversations/{id}/messages instead.
import { createUIMessageStreamResponse, toUIMessageStream } from "ai";
import { after } from "next/server";
import { authenticate, errors, readJson, route } from "@/lib/api";
import { friendlyError, getConversation, isRateLimited, MAX_MESSAGE_CHARS, startReply } from "@/lib/chat-service";
import { isModelId, type ModelId } from "@/lib/models";

export const maxDuration = 60;
const MAX_BUBBLES_PER_SEND = 10;

export const POST = route(async (req) => {
  const { db } = await authenticate(req);
  const body = await readJson(req);

  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  // `texts` = several bubbles sent together; `text` = a single message.
  const raw: unknown[] = Array.isArray(body.texts) ? body.texts : [body.text];
  const contents = raw.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, MAX_BUBBLES_PER_SEND);
  if (!contents.length) throw errors.badRequest("Message is empty.");
  if (contents.some((c) => c.length > MAX_MESSAGE_CHARS)) throw errors.badRequest(`Message is longer than ${MAX_MESSAGE_CHARS} characters.`);

  const conversation = await getConversation(db, conversationId).catch(() => null);
  if (!conversation) throw errors.notFound("Conversation");
  if (await isRateLimited(db)) throw errors.rateLimited();

  const { result, replyId, learn } = await startReply(db, {
    conversation,
    content: contents,
    model: isModelId(body.model) ? (body.model as ModelId) : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone.slice(0, 64) : undefined,
    abortSignal: req.signal,
  });
  after(learn); // update memories once the reply is done, without delaying it

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: friendlyError,
      // Lets the UI rate this reply (thumbs up/down) as soon as it's done.
      messageMetadata: ({ part }) => (part.type === "start" ? { replyId, createdAt: new Date().toISOString() } : undefined),
    }),
  });
});
