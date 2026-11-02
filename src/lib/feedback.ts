// Thumbs up/down on persona replies, and the admin-only stats built from them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchema } from "./db-errors";

export const FEEDBACK_REASONS = ["too_long", "too_short", "out_of_character", "repetitive", "too_much", "other"] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

export const REASON_LABELS: Record<FeedbackReason, string> = {
  too_long: "Too long",
  too_short: "Too short",
  out_of_character: "Out of character",
  repetitive: "Repetitive",
  too_much: "Too intense",
  other: "Other",
};

export type Feedback = { reply_id: string; rating: 1 | -1; reason: FeedbackReason | null };

export const isReason = (x: unknown): x is FeedbackReason => FEEDBACK_REASONS.includes(x as FeedbackReason);

export async function listFeedback(db: SupabaseClient, conversationId: string) {
  const { data, error } = await db.from("feedback").select("reply_id, rating, reason").eq("conversation_id", conversationId);
  if (error && isMissingSchema(error)) return []; // schema v4 not run yet
  if (error) throw error;
  return data as Feedback[];
}

/** Finds the conversation a reply belongs to (RLS: only the user's own replies are visible). */
async function conversationOfReply(db: SupabaseClient, replyId: string) {
  const { data, error } = await db
    .from("messages")
    .select("conversation_id")
    .eq("reply_id", replyId)
    .eq("role", "assistant")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.conversation_id as string | undefined) ?? null;
}

/** Saves (or changes) the user's rating of a reply. Returns null if the reply doesn't exist. */
export async function setFeedback(
  db: SupabaseClient,
  userId: string,
  replyId: string,
  input: { rating: 1 | -1; reason: FeedbackReason | null },
) {
  const conversationId = await conversationOfReply(db, replyId);
  if (!conversationId) return null;
  const row = {
    user_id: userId,
    conversation_id: conversationId,
    reply_id: replyId,
    rating: input.rating,
    // A reason only makes sense with thumbs down.
    reason: input.rating === -1 ? input.reason : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("feedback")
    .upsert(row, { onConflict: "user_id,reply_id" })
    .select("reply_id, rating, reason")
    .single();
  if (error) throw error;
  return data as Feedback;
}

export async function clearFeedback(db: SupabaseClient, replyId: string) {
  const { error } = await db.from("feedback").delete().eq("reply_id", replyId);
  if (error) throw error;
}

export async function isAdmin(db: SupabaseClient) {
  const { data, error } = await db.rpc("is_admin");
  if (error) throw error;
  return data === true;
}

export type PersonaStatsRow = {
  persona_id: string;
  persona_name: string | null;
  model: string | null;
  kind: "reply" | "checkin";
  users: number;
  conversations: number;
  replies: number;
  enough_data: boolean;
  reply_rate: number | null;
  median_reply_seconds: number | null;
  avg_user_words: number | null;
  avg_words: number | null;
  avg_bubbles: number | null;
  avg_emoji: number | null;
  question_rate: number | null;
  median_latency_ms: number | null;
  thumbs_up: number | null;
  thumbs_down: number | null;
  top_down_reason: FeedbackReason | null;
};

export type RetentionRow = {
  persona_id: string;
  persona_name: string | null;
  users: number;
  enough_data: boolean;
  returned_day1: number | null;
  returned_day7: number | null;
  sessions: number;
  messages_per_session: number | null;
};

// Postgres numeric/bigint arrive as strings; turn them into numbers.
function numbers<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v])),
  ) as T[];
}

export async function getStats(db: SupabaseClient, days: number) {
  const [replies, retention] = await Promise.all([
    db.rpc("persona_stats", { p_days: days }),
    db.rpc("persona_retention", { p_days: days }),
  ]);
  if (replies.error) throw replies.error;
  if (retention.error) throw retention.error;
  return {
    replies: numbers<PersonaStatsRow>(replies.data ?? []),
    retention: numbers<RetentionRow>(retention.data ?? []),
  };
}
