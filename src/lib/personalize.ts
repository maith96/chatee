// Per-user style: each persona tunes HOW it texts to the person, learned from their signals.
// Guardrails: adjustments come from a fixed list and only touch style (length, emoji, variety,
// intensity). Personality, romance, check-ins and safety rules never change. Users can see them,
// reset them per persona, or switch personalisation off.
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectCrisis } from "./crisis";
import { isMissingSchema } from "./db-errors";
import type { PersonaDefinition } from "./persona-schema";
import { countEmoji, countWords } from "./reply-stats";

export type AdjustmentId = "shorter" | "more_detail" | "vary" | "calmer" | "brief_like_them" | "fuller_like_them" | "fewer_emoji";

export type Adjustment = {
  id: AdjustmentId;
  /** Shown to the user. */
  label: string;
  because: string;
  /** Added to the persona's prompt. */
  instruction: string;
};

const MIN_REASONS = 2; // thumbs-down reasons needed before acting on them
const MIN_MESSAGES = 10; // user messages needed before matching how they text
const RECENT_FEEDBACK = 20;
const RECENT_MESSAGES = 30;

export type Signals = {
  /** Recent thumbs-down reasons for this persona, newest first. */
  downReasons: string[];
  /** Recent messages the user sent this persona, newest first. */
  userMessages: string[];
};

const times = (n: number) => (n === 1 ? "once" : `${n} times`);

/** Pure: turns signals into style adjustments. */
export function deriveAdjustments(def: PersonaDefinition, signals: Signals): Adjustment[] {
  const count = (r: string) => signals.downReasons.filter((x) => x === r).length;
  const out: Adjustment[] = [];

  const lengthVote = count("too_long") - count("too_short");
  if (lengthVote >= MIN_REASONS) {
    out.push({
      id: "shorter",
      label: "Shorter replies",
      because: `You marked replies as too long ${times(count("too_long"))}.`,
      instruction: "Keep your replies short for this person: usually one or two sentences, even when you have more to say.",
    });
  } else if (-lengthVote >= MIN_REASONS) {
    out.push({
      id: "more_detail",
      label: "A bit more detail",
      because: `You marked replies as too short ${times(count("too_short"))}.`,
      instruction: "Give a little more substance in your replies (an extra thought or detail), still in your own voice.",
    });
  }
  if (count("repetitive") >= MIN_REASONS) {
    out.push({
      id: "vary",
      label: "More variety",
      because: `You marked replies as repetitive ${times(count("repetitive"))}.`,
      instruction: "Vary yourself more: different openers, reactions and topics. Don't reuse phrases from earlier in the chat.",
    });
  }
  if (count("too_much") >= MIN_REASONS) {
    out.push({
      id: "calmer",
      label: "Calmer, less intense",
      because: `You marked replies as too intense ${times(count("too_much"))}.`,
      instruction: "Tone it down: be calmer and less intense, with less exclamation and fewer big reactions.",
    });
  }

  // How they text (only messages that aren't about a crisis).
  const msgs = signals.userMessages.filter((m) => !detectCrisis(m)).slice(0, RECENT_MESSAGES);
  if (msgs.length >= MIN_MESSAGES) {
    const avgWords = msgs.reduce((s, m) => s + countWords(m), 0) / msgs.length;
    const withEmoji = msgs.filter((m) => countEmoji(m) > 0).length;
    const hasLength = out.some((a) => a.id === "shorter" || a.id === "more_detail");
    if (!hasLength && avgWords <= 5 && def.communication.length !== "short") {
      out.push({
        id: "brief_like_them",
        label: "Brief replies",
        because: "You usually send short messages.",
        instruction: "They text in short bursts: match that with brief replies, usually a single sentence.",
      });
    } else if (!hasLength && avgWords >= 30) {
      out.push({
        id: "fuller_like_them",
        label: "Fuller replies when it fits",
        because: "You usually write longer messages.",
        instruction: "They write long, thoughtful messages: when it fits, you can reply a little more fully.",
      });
    }
    if (withEmoji === 0 && def.communication.emoji !== "none") {
      out.push({
        id: "fewer_emoji",
        label: "Fewer emoji",
        because: "You don't use emoji.",
        instruction: "Use emoji only rarely with this person.",
      });
    }
  }
  return out;
}

export type StyleState = { personalize: boolean; resetAt: string | null; adjustments: Adjustment[] };

/** Loads the user's signals for a persona and works out the adjustments (none if switched off). */
export async function loadStyle(db: SupabaseClient, persona: { id: string; definition: PersonaDefinition }): Promise<StyleState> {
  const [personalize, resetAt] = await Promise.all([getPersonalize(db), getResetAt(db, persona.id)]);
  if (!personalize) return { personalize, resetAt, adjustments: [] };

  const { data: convs, error } = await db.from("conversations").select("id").eq("persona_id", persona.id);
  if (error) throw error;
  const ids = (convs ?? []).map((c) => c.id as string);
  if (!ids.length) return { personalize, resetAt, adjustments: [] };

  let feedbackQuery = db
    .from("feedback")
    .select("reason, created_at")
    .in("conversation_id", ids)
    .eq("rating", -1)
    .order("created_at", { ascending: false })
    .limit(RECENT_FEEDBACK);
  let messagesQuery = db
    .from("messages")
    .select("content, created_at")
    .in("conversation_id", ids)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(RECENT_MESSAGES);
  if (resetAt) {
    feedbackQuery = feedbackQuery.gte("created_at", resetAt);
    messagesQuery = messagesQuery.gte("created_at", resetAt);
  }
  const [feedback, messages] = await Promise.all([feedbackQuery, messagesQuery]);
  if (messages.error) throw messages.error;
  if (feedback.error && !isMissingSchema(feedback.error)) throw feedback.error;

  const adjustments = deriveAdjustments(persona.definition, {
    downReasons: (feedback.data ?? []).map((f) => f.reason as string).filter(Boolean),
    userMessages: (messages.data ?? []).map((m) => m.content as string),
  });
  return { personalize, resetAt, adjustments };
}

async function getPersonalize(db: SupabaseClient) {
  const { data, error } = await db.from("profiles").select("personalize").maybeSingle();
  if (error && isMissingSchema(error)) return true; // schema v6 not run yet: default on
  if (error) throw error;
  return (data?.personalize as boolean | undefined) ?? true;
}

async function getResetAt(db: SupabaseClient, personaId: string) {
  const { data, error } = await db.from("relationships").select("style_reset_at").eq("persona_id", personaId).maybeSingle();
  if (error && isMissingSchema(error)) return null;
  if (error) throw error;
  return (data?.style_reset_at as string | null | undefined) ?? null;
}

/** Start learning this persona's style for the user from scratch. */
export async function resetStyle(db: SupabaseClient, personaId: string) {
  const { error } = await db.from("relationships").update({ style_reset_at: new Date().toISOString() }).eq("persona_id", personaId);
  if (error) throw error;
}

/** Turn personalisation on or off for all personas. */
export async function setPersonalize(db: SupabaseClient, userId: string, on: boolean) {
  const { error } = await db.from("profiles").upsert({ user_id: userId, personalize: on }, { onConflict: "user_id" });
  if (error) throw error;
}
