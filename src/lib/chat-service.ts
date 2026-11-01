// Shared chat logic used by BOTH the web app (/api/chat) and the public API (/api/v1).
// Keeping it in one place means the later app gets exactly the same behaviour as the website.
import { streamText } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ModelId } from "./models";
import { defaultModelId, resolveModel } from "./providers";

export const SYSTEM_PROMPT =
  "You are Persona, a friendly and helpful AI assistant. Answer clearly and concisely. " +
  "Use Markdown for formatting when it helps (lists, tables, code blocks).";

export const MAX_MESSAGE_CHARS = 8000;
const HISTORY_LIMIT = 40; // how many past messages are sent to the model

export type Conversation = {
  id: string;
  title: string;
  model: ModelId;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  created_at: string;
};

const CONVERSATION_FIELDS = "id, title, model, created_at, updated_at";
const MESSAGE_FIELDS = "id, conversation_id, role, content, model, created_at";
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

export async function createConversation(db: SupabaseClient, input: { title?: string; model?: ModelId }) {
  const { data, error } = await db
    .from("conversations")
    .insert({ title: input.title?.trim() || DEFAULT_TITLE, model: resolveModel(input.model ?? defaultModelId()).model.id })
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

async function insertMessage(
  db: SupabaseClient,
  row: { conversation_id: string; role: "user" | "assistant"; content: string; model?: string },
) {
  const { data, error } = await db.from("messages").insert(row).select(MESSAGE_FIELDS).single();
  if (error) throw error;
  return data as Message;
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
  opts: { conversation: Conversation; content: string; model?: ModelId; abortSignal?: AbortSignal },
) {
  const { model, languageModel } = resolveModel(opts.model ?? opts.conversation.model);
  const history = await listMessages(db, opts.conversation.id);

  // Retry-safe: if the last saved message is this same user message (its reply failed), reuse it.
  const last = history.at(-1);
  const isRetry = last?.role === "user" && last.content === opts.content;
  if (isRetry) history.pop();
  const userMessage = isRetry
    ? last
    : await insertMessage(db, { conversation_id: opts.conversation.id, role: "user", content: opts.content });

  // Name the chat after its first message (free: no extra model call).
  if (history.length === 0 && opts.conversation.title === DEFAULT_TITLE) {
    const title = opts.content.replace(/\s+/g, " ").trim().slice(0, 60);
    await updateConversation(db, opts.conversation.id, { title: title || DEFAULT_TITLE });
  }
  if (model.id !== opts.conversation.model) {
    await updateConversation(db, opts.conversation.id, { model: model.id });
  }

  let streamError: unknown; // the real provider error (result.text only reports "no output")
  let resolveSaved!: (m: Message | null) => void;
  const saved = new Promise<Message | null>((r) => (resolveSaved = r));

  const result = streamText({
    model: languageModel,
    instructions: SYSTEM_PROMPT,
    messages: [...history.slice(-HISTORY_LIMIT), userMessage].map((m) => ({ role: m.role, content: m.content })),
    abortSignal: opts.abortSignal,
    onEnd: async ({ text }) => {
      try {
        resolveSaved(
          text.trim()
            ? await insertMessage(db, {
                conversation_id: opts.conversation.id,
                role: "assistant",
                content: text,
                model: model.id,
              })
            : null,
        );
      } catch (err) {
        console.error("Failed to save assistant message", err);
        resolveSaved(null);
      }
    },
    onError: ({ error }) => {
      streamError = error;
      console.error("Model error", error);
      resolveSaved(null);
    },
  });

  return { result, userMessage, saved, model, getError: () => streamError };
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
