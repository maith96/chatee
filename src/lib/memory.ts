// Persona memory and relationship state.
// - memories: facts about the user, and details the persona said about itself (for consistency)
// - relationships: how much this user and persona have talked; drives the relationship stage
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import type { Persona } from "./personas";
import type { Stage } from "./prompt-builder";
import { resolveModel } from "./providers";

export type Memory = { id: string; persona_id: string; kind: "user" | "self"; content: string; created_at: string };
export type Relationship = {
  user_messages: number;
  first_chat_at: string;
  last_user_message_at: string | null;
  last_checkin_at: string | null;
};

const MAX_USER_FACTS = 60;
const MAX_SELF_FACTS = 30;
const FIELDS = "id, persona_id, kind, content, created_at";

export async function listMemories(db: SupabaseClient, personaId: string) {
  const { data, error } = await db
    .from("memories")
    .select(FIELDS)
    .eq("persona_id", personaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const all = data as Memory[];
  return { user: all.filter((m) => m.kind === "user"), self: all.filter((m) => m.kind === "self") };
}

export async function deleteMemory(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("memories").delete().eq("id", id).select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function forgetPersona(db: SupabaseClient, personaId: string) {
  const { error } = await db.from("memories").delete().eq("persona_id", personaId);
  if (error) throw error;
}

export async function getRelationship(db: SupabaseClient, personaId: string) {
  const { data, error } = await db
    .from("relationships")
    .select("user_messages, first_chat_at, last_user_message_at, last_checkin_at")
    .eq("persona_id", personaId)
    .maybeSingle();
  if (error) throw error;
  return data as Relationship | null;
}

/** Counts one user message (atomic, in the database). */
export async function bumpRelationship(db: SupabaseClient, personaId: string) {
  const { data, error } = await db.rpc("bump_relationship", { p_persona_id: personaId });
  if (error) throw error;
  return data as Relationship;
}

export async function markCheckIn(db: SupabaseClient, personaId: string) {
  const { error } = await db
    .from("relationships")
    .update({ last_checkin_at: new Date().toISOString() })
    .eq("persona_id", personaId);
  if (error) throw error;
}

/**
 * Relationship stage. Needs BOTH enough conversation and enough time, so it can't be rushed:
 * new → warm after ~30 messages over 2+ days; warm → close after ~150 messages over 10+ days.
 */
export function stageFor(rel: Relationship | null, now = Date.now()): Stage {
  if (!rel) return "new";
  const days = (now - new Date(rel.first_chat_at).getTime()) / 86_400_000;
  if (rel.user_messages >= 150 && days >= 10) return "close";
  if (rel.user_messages >= 30 && days >= 2) return "warm";
  return "new";
}

export const STAGE_LABELS: Record<Stage, string> = {
  new: "Getting to know each other",
  warm: "Getting closer",
  close: "Close",
};

// ---------- extraction ------------------------------------------------------------------------

const EXTRACT_PROMPT = (name: string, userFacts: string[], selfFacts: string[], user: string, reply: string) =>
  `You maintain the memory of ${name}, an AI character, about the user they're chatting with.

Already remembered about the user:
${userFacts.length ? userFacts.map((f) => `- ${f}`).join("\n") : "(nothing yet)"}

Already remembered about ${name} (things ${name} has said about themselves):
${selfFacts.length ? selfFacts.map((f) => `- ${f}`).join("\n") : "(nothing yet)"}

Latest exchange:
USER: ${user}
${name.toUpperCase()}: ${reply}

Extract only NEW, lasting facts worth remembering for future chats:
- "user": facts the USER stated about themselves or their life: name, pets, people, job or studies, upcoming events (with dates if given), preferences, ongoing situations. Write them as short notes about "the user" without naming them as the subject, e.g. "Name is Sam", "Has a dog called Biscuit; vet appointment on Friday", "Works night shifts as a nurse".
- "self": concrete new details ${name} invented about their own life in this reply (to stay consistent later), e.g. "Has a sister who visits on weekends". Skip details already covered by ${name}'s character.
Rules: don't repeat or rephrase anything already remembered; skip small talk, moods that pass, and things ${name} said about the user; never store passwords, financial or ID numbers, exact addresses, health conditions, sexuality, or anything about self-harm or crisis. If nothing qualifies, use empty lists.

Reply with ONLY JSON: {"user": ["..."], "self": ["..."]}`;

function parseFacts(text: string): { user: string[]; self: string[] } {
  try {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const clean = (xs: unknown) =>
      (Array.isArray(xs) ? xs : [])
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 300))
        .filter((x) => x.length > 3)
        .slice(0, 5);
    return { user: clean(json.user), self: clean(json.self) };
  } catch {
    return { user: [], self: [] };
  }
}

const similar = (a: string, b: string) => {
  const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const wa = words(a);
  const wb = words(b);
  const overlap = [...wa].filter((w) => wb.has(w)).length;
  return overlap / Math.max(1, Math.min(wa.size, wb.size)) > 0.8;
};

const STOPWORDS = new Set("the and for with that this has have had was were are is their they them from about into your you user users called named likes like loves love works work".split(" "));
const keyWords = (s: string) =>
  (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length >= 3 && !STOPWORDS.has(w));

/**
 * Grounding check: a fact is only kept if most of its key words actually appear in what was said.
 * Allows paraphrase ("Works night shifts as a nurse") but rejects invented details.
 */
export function isGrounded(fact: string, source: string) {
  const words = keyWords(fact);
  if (!words.length) return false;
  const src = source.toLowerCase();
  const found = words.filter((w) => src.includes(w) || (w.length > 4 && src.includes(w.slice(0, -1))));
  return found.length / words.length >= 0.5;
}

/** After a reply: pull out new facts with a fast model and save them. Runs after the response is sent. */
export async function extractMemories(
  db: SupabaseClient,
  persona: Persona,
  userText: string,
  replyText: string,
  existing: { user: Memory[]; self: Memory[] },
) {
  if (!replyText.trim()) return;
  const { languageModel, providerOptions } = resolveModel("nova-fast");
  const { text } = await generateText({
    model: languageModel,
    providerOptions,
    maxOutputTokens: 400,
    prompt: EXTRACT_PROMPT(
      persona.name,
      existing.user.map((m) => m.content),
      existing.self.map((m) => m.content),
      userText,
      replyText,
    ),
  });
  const facts = parseFacts(text);
  const known = [...existing.user, ...existing.self].map((m) => m.content);
  const rows = [
    // User facts must come from what the user said; self facts from what the persona said.
    ...facts.user.filter((f) => isGrounded(f, userText)).map((content) => ({ persona_id: persona.id, kind: "user" as const, content })),
    ...facts.self.filter((f) => isGrounded(f, replyText)).map((content) => ({ persona_id: persona.id, kind: "self" as const, content })),
  ].filter((r) => !known.some((k) => similar(k, r.content)));
  if (!rows.length) return;
  const { error } = await db.from("memories").insert(rows);
  if (error) throw error;

  // Keep memory bounded: drop the oldest beyond the caps.
  for (const [kind, cap] of [["user", MAX_USER_FACTS], ["self", MAX_SELF_FACTS]] as const) {
    const count = existing[kind].length + rows.filter((r) => r.kind === kind).length;
    if (count > cap) {
      const drop = existing[kind].slice(0, count - cap).map((m) => m.id);
      if (drop.length) await db.from("memories").delete().in("id", drop);
    }
  }
}
