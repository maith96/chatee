import { assertUuid, authenticate, errors, json, preflight, readJson, route } from "@/lib/api";
import { getConversation } from "@/lib/chat-service";
import { maybeCheckIn } from "@/lib/checkin";

// Room for after-reply work (memories, and sometimes refreshing the shared news digest).
export const maxDuration = 300;

// POST /api/v1/conversations/{id}/checkin  { "timezone"?: "Europe/London" }
// Call when the user opens a persona chat. If they've been away long enough, the persona texts
// first and the new messages are returned; otherwise "messages" is empty. Never stacks check-ins.
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id);
  const { db } = await authenticate(req);
  const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
  const conversation = await getConversation(db, id);
  if (!conversation) throw errors.notFound("Conversation");
  const messages = await maybeCheckIn(db, conversation, {
    timezone: typeof body.timezone === "string" ? body.timezone.slice(0, 64) : undefined,
  });
  return json(req, { messages });
});

export const OPTIONS = preflight;
