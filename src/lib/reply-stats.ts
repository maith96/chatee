// Style numbers saved with each message, so engagement can be measured without reading text later.
import { createHash, randomUUID } from "node:crypto";
import type { Persona } from "./personas";
import { PROMPT_VERSION } from "./prompt-builder";

const EMOJI = /\p{Extended_Pictographic}/gu;

export function countWords(text: string) {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

export function countEmoji(text: string) {
  return (text.match(EMOJI) ?? []).length;
}

export function hasQuestion(text: string) {
  return /\?/.test(text);
}

/** Changes whenever the prompt builder or the persona's definition changes, so before/after can be compared. */
export function promptVersion(persona: Pick<Persona, "definition"> | null) {
  if (!persona) return PROMPT_VERSION;
  const hash = createHash("sha256").update(JSON.stringify(persona.definition)).digest("hex").slice(0, 8);
  return `${PROMPT_VERSION}.${hash}`;
}

export const newReplyId = () => randomUUID();

/** One row per bubble of an assistant reply, all sharing reply_id. */
export function assistantRows(
  conversationId: string,
  bubbles: string[],
  opts: { replyId: string; model: string; persona: Persona | null; kind?: "reply" | "checkin"; latencyMs?: number },
) {
  const version = promptVersion(opts.persona);
  return bubbles.map((content, i) => ({
    conversation_id: conversationId,
    role: "assistant" as const,
    content,
    model: opts.model,
    kind: opts.kind ?? ("reply" as const),
    reply_id: opts.replyId,
    prompt_version: version,
    words: countWords(content),
    emoji: countEmoji(content),
    has_question: hasQuestion(content),
    bubble_index: i,
    bubble_count: bubbles.length,
    latency_ms: opts.latencyMs != null ? Math.round(opts.latencyMs) : undefined,
  }));
}
