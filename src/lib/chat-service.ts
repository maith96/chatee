// Shared chat logic used by BOTH the web app (/api/chat) and the public API (/api/v1).
// Keeping it in one place means the later app gets exactly the same behaviour as the website.
import { streamText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { joinBubbles, splitBubbles } from "./bubbles";
import { type ModelId } from "./models";
import { getPersona, type Persona } from "./personas";
import { bumpRelationship, extractMemories, getRelationship, listMemories, stageFor, type Memory, type Relationship } from "./memory";
import { buildPersonaPrompt, detectCrisis, detectMinor } from "./prompt-builder";
import { defaultModelId, resolveModel } from "./providers";
import { assistantRows, countWords, newReplyId } from "./reply-stats";

export const SYSTEM_PROMPT =
  "You are Persona, a friendly and helpful AI assistant. Answer clearly and concisely. " +
  "Use Markdown for formatting when it helps (lists, tables, code blocks).";

export const MAX_MESSAGE_CHARS = 8000;
const HISTORY_LIMIT = 40; // how many past messages are sent to the model

export type Conversation = {
  id: string;
  title: string;
  model: ModelId;
  persona_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  kind?: "reply" | "checkin";
  /** Shared by all bubbles of one assistant reply; feedback is given per reply. */
  reply_id?: string | null;
  created_at: string;
};

const CONVERSATION_FIELDS = "id, title, model, persona_id, created_at, updated_at";
const MESSAGE_FIELDS = "id, conversation_id, role, content, model, kind, reply_id, created_at";
export const DEFAULT_TITLE = "New conversation";

// ---- Conversations -------------------------------------------------------

export async function listConversations(db: SupabaseClient, limit = 50) {
  const { data, error } = await db
    .from("conversations")
    .select(CONVERSATION_FIELDS)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Conversation[];
}

export async function getConversation(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("conversations").select(CONVERSATION_FIELDS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

export async function createConversation(
  db: SupabaseClient,
  input: { title?: string; model?: ModelId; personaId?: string | null },
) {
  const { data, error } = await db
    .from("conversations")
    .insert({
      title: input.title?.trim() || DEFAULT_TITLE,
      model: resolveModel(input.model ?? defaultModelId()).model.id,
      persona_id: input.personaId ?? null,
    })
    .select(CONVERSATION_FIELDS)
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function updateConversation(db: SupabaseClient, id: string, patch: { title?: string; model?: ModelId }) {
  const { data, error } = await db
    .from("conversations")
    .update(patch)
    .eq("id", id)
    .select(CONVERSATION_FIELDS)
    .maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

export async function deleteConversation(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("conversations").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ---- Messages ------------------------------------------------------------

export async function listMessages(db: SupabaseClient, conversationId: string) {
  const { data, error } = await db
    .from("messages")
    .select(MESSAGE_FIELDS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Message[];
}

type NewMessage = {
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  kind?: "reply" | "checkin";
  created_at?: string;
  // Metadata for stats (see reply-stats.ts and schema v4).
  reply_id?: string;
  prompt_version?: string;
  words?: number;
  emoji?: number;
  has_question?: boolean;
  bubble_index?: number;
  bubble_count?: number;
  latency_ms?: number;
  crisis?: boolean;
};

/** Saves several bubbles at once, 1ms apart so they keep their order. */
export async function insertMessages(db: SupabaseClient, rows: NewMessage[]) {
  const start = Date.now();
  const stamped = rows.map((r, i) => ({ ...r, created_at: new Date(start + i).toISOString() }));
  const { data, error } = await db.from("messages").insert(stamped).select(MESSAGE_FIELDS);
  if (error) throw error;
  return (data as Message[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** History for the model: consecutive assistant bubbles become one turn, in the bubble format. */
export function toModelMessages(messages: Message[]) {
  const turns: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    const prev = turns.at(-1);
    if (prev && prev.role === m.role && m.role === "assistant") prev.content = joinBubbles([prev.content, m.content]);
    else if (prev && prev.role === m.role) prev.content += `\n${m.content}`;
    else turns.push({ role: m.role, content: m.content });
  }
  return turns;
}

function noteDate(iso: string, timezone?: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Date(iso).toDateString();
  }
}

export type PersonaState = { memories: { user: Memory[]; self: Memory[] }; relationship: Relationship | null };

export async function loadPersonaState(db: SupabaseClient, personaId: string): Promise<PersonaState> {
  const [memories, relationship] = await Promise.all([listMemories(db, personaId), getRelationship(db, personaId)]);
  return { memories, relationship };
}

/** The system prompt: the persona's if the chat has one, otherwise the plain assistant. */
export function systemPromptFor(
  persona: Persona | null,
  state: PersonaState | null,
  history: Message[],
  opts: { latest?: string; timezone?: string; task?: string } = {},
) {
  if (!persona) return SYSTEM_PROMPT;
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const minutesSinceLastUserMessage = lastUser ? (Date.now() - new Date(lastUser.created_at).getTime()) / 60000 : null;
  return buildPersonaPrompt(persona.name, persona.definition, {
    timezone: opts.timezone,
    minutesSinceLastUserMessage,
    stage: stageFor(state?.relationship ?? null),
    turn: history.filter((m) => m.role === "user").length,
    // Dated, so the persona can tell "Friday" was upcoming vs. already past.
    memories: state?.memories.user.map((m) => `${m.content} (noted ${noteDate(m.created_at, opts.timezone)})`),
    selfFacts: state?.memories.self.map((m) => m.content),
    crisis: opts.latest ? detectCrisis(opts.latest) : false,
    minor: opts.latest ? detectMinor(opts.latest) : false,
    task: opts.task,
  });
}

/** Simple per-user rate limit backed by the messages table (works on serverless, no extra service). */
export async function isRateLimited(db: SupabaseClient) {
  const limit = Number(process.env.RATE_LIMIT_PER_MINUTE) || 15;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since);
  if (error) throw error;
  return (count ?? 0) >= limit;
}

/**
 * Saves the user's message, then streams Gemini's reply.
 * The reply is saved to the database when it finishes; `saved` resolves with the stored row.
 */
export async function startReply(
  db: SupabaseClient,
  opts: { conversation: Conversation; content: string | string[]; model?: ModelId; timezone?: string; abortSignal?: AbortSignal },
) {
  const { model, languageModel, providerOptions } = resolveModel(opts.model ?? opts.conversation.model);
  const personaId = opts.conversation.persona_id;
  const [history, persona, state] = await Promise.all([
    listMessages(db, opts.conversation.id),
    personaId ? getPersona(db, personaId) : Promise.resolve(null),
    personaId ? loadPersonaState(db, personaId) : Promise.resolve(null),
  ]);
  // Computed before the new message is saved, so "time since last message" is the real gap.
  const latest = Array.isArray(opts.content) ? opts.content.join("\n") : opts.content;
  const instructions = systemPromptFor(persona, state, history, { latest, timezone: opts.timezone });

  // Several texts sent in quick succession arrive together and are saved as separate bubbles.
  const contents = Array.isArray(opts.content) ? opts.content : [opts.content];

  // Retry-safe: if the trailing saved user messages are exactly these texts (their reply failed), reuse them.
  let start = history.length;
  while (start > 0 && history[start - 1].role === "user") start--;
  const trailing = history.slice(start);
  const isRetry = trailing.length === contents.length && trailing.every((m, i) => m.content === contents[i]);
  if (isRetry) history.splice(start);
  const userMessages = isRetry
    ? trailing
    : await insertMessages(
        db,
        contents.map((content) => ({
          conversation_id: opts.conversation.id,
          role: "user" as const,
          content,
          words: countWords(content),
          crisis: detectCrisis(content),
        })),
      );
  const userMessage = userMessages.at(-1)!;
  // Count each text towards the relationship (they were separate messages).
  if (persona && !isRetry) for (let i = 0; i < contents.length; i++) await bumpRelationship(db, persona.id);

  // Name the chat after its first message (free: no extra model call).
  if (history.length === 0 && opts.conversation.title === DEFAULT_TITLE) {
    const title = contents[0].replace(/\s+/g, " ").trim().slice(0, 60);
    await updateConversation(db, opts.conversation.id, { title: title || DEFAULT_TITLE });
  }
  if (model.id !== opts.conversation.model) {
    await updateConversation(db, opts.conversation.id, { model: model.id });
  }

  let streamError: unknown; // the real provider error (result.text only reports "no output")
  const replyId = newReplyId();
  const startedAt = Date.now();
  let firstTokenAt: number | undefined;
  let resolveSaved!: (m: Message[]) => void;
  const saved = new Promise<Message[]>((r) => (resolveSaved = r));

  const result = streamText({
    model: languageModel,
    providerOptions,
    instructions,
    messages: toModelMessages([...history.slice(-HISTORY_LIMIT), ...userMessages]),
    abortSignal: opts.abortSignal,
    onChunk: ({ chunk }) => {
      if (firstTokenAt === undefined && chunk.type === "text-delta") firstTokenAt = Date.now();
    },
    onEnd: async ({ text }) => {
      try {
        // Persona replies can be several bubbles: one row each. The plain assistant keeps one row.
        const c = persona?.definition.communication;
        const parts = c
          ? splitBubbles(text, { paragraphs: c.bubbles > 1, max: c.bubbles })
          : text.trim()
            ? [text]
            : [];
        resolveSaved(
          parts.length
            ? await insertMessages(
                db,
                assistantRows(opts.conversation.id, parts, {
                  replyId,
                  model: model.id,
                  persona,
                  latencyMs: firstTokenAt !== undefined ? firstTokenAt - startedAt : undefined,
                }),
              )
            : [],
        );
      } catch (err) {
        console.error("Failed to save assistant message", err);
        resolveSaved([]);
      }
    },
    onError: ({ error }) => {
      streamError = error;
      console.error("Model error", error);
      resolveSaved([]);
    },
  });

  /** Learn from this exchange (new memories). Call from `after()` so it never delays the reply. */
  async function learn() {
    if (!persona || !state) return;
    const bubbles = await saved;
    if (!bubbles.length) return;
    try {
      await extractMemories(db, persona, contents.join("\n"), bubbles.map((b) => b.content).join("\n"), state.memories);
    } catch (err) {
      console.error("Memory extraction failed", err);
    }
  }

  return { result, replyId, userMessage, userMessages, saved, model, persona, learn, getError: () => streamError };
}

/** Turns provider errors into a message that is safe and useful to show users. */
export function friendlyError(error: unknown): string {
  // Retry errors wrap the real one; prefer the last underlying error.
  const inner = (error as { lastError?: unknown })?.lastError ?? error;
  const status = (inner as { statusCode?: number })?.statusCode;
  const text = inner instanceof Error ? inner.message : String(inner);

  if (status === 401 || status === 403 || /api key|unauthori[sz]ed|forbidden/i.test(text))
    return "The AI provider's API key is missing or invalid on the server.";
  if (status === 429 || /quota|rate.?limit|exhausted|too many requests/i.test(text))
    return "The AI provider's rate limit was hit. Wait a minute or switch models.";
  if (status === 404 || /model.*not found/i.test(text))
    return "That model isn't available for this API key. Try another model.";
  if ((status && status >= 500) || /timeout|timed out|overloaded|unavailable/i.test(text))
    return "The model is busy right now. Try again or pick another model.";
  return "Something went wrong while generating a reply. Please try again.";
}
