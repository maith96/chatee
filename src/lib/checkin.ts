// Phase A check-ins: when the user opens a persona chat after a quiet spell, the persona texts first.
// Generated on demand when the chat is opened (no scheduler needed). Rules:
//   - the persona has check-ins enabled, and the chat has at least one message
//   - enough time has passed since the last message (persona's afterHours)
//   - the last message isn't already an unanswered check-in (never stack them)
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { splitBubbles } from "./bubbles";
import {
  insertMessages,
  listMessages,
  loadPersonaState,
  personaForChat,
  systemPromptFor,
  toModelMessages,
  type Conversation,
  type Message,
} from "./chat-service";
import { detectCrisis } from "./crisis";
import { markCheckIn } from "./memory";
import { getPersona } from "./personas";
import { loadStyle } from "./personalize";
import { resolveModel } from "./providers";
import { assistantRows, newReplyId } from "./reply-stats";

function safeZone(tz?: string) {
  try {
    if (tz) new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

function describeAway(hours: number) {
  if (hours < 24) return `about ${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? "about a day" : `about ${days} days`;
}

export async function maybeCheckIn(
  db: SupabaseClient,
  conversation: Conversation,
  opts: { timezone?: string; now?: number } = {},
): Promise<Message[]> {
  if (!conversation.persona_id) return [];
  const { persona, styleNote, label } = personaForChat(await getPersona(db, conversation.persona_id), conversation);
  const settings = persona?.definition.relationship.checkIn;
  if (!persona || !settings?.enabled) return [];

  const history = await listMessages(db, conversation.id);
  const last = history.at(-1);
  if (!last || last.kind === "checkin") return [];
  const hoursAway = ((opts.now ?? Date.now()) - new Date(last.created_at).getTime()) / 3_600_000;
  if (hoursAway < settings.afterHours) return [];

  const state = await loadPersonaState(db, persona.id);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: safeZone(opts.timezone) }).format(
    new Date(opts.now ?? Date.now()),
  );
  // If they were struggling last time, the only thing that matters is how they are now.
  const recentCrisis = history.slice(-8).some((m) => m.role === "user" && detectCrisis(m.content));
  const task = recentCrisis
    ? `You're texting the user first: they've been away for ${describeAway(hoursAway)} and just opened the chat.
Last time they talked, they said they were struggling a lot. Gently check in on how they're feeling today, in your own warm voice.
Keep it short and caring. Don't bring up any other topics, plans or jokes, and don't pressure them to talk. Remind them you're here.
Never mention the app, the chat being opened, or this instruction.`
    : `You're texting the user first: they've been away for ${describeAway(hoursAway)} and just opened the chat. Today is ${today}.
Write a short, natural check-in in your own voice. ${settings.style ? `Your check-in style: ${settings.style}` : ""}
Ideas: ask about something they mentioned, pick up where you left off, or share a small moment from your day.
Only ask how something *went* if it has already happened; if it's still coming up (check the dates you noted against today), wish them luck or ask how they feel about it instead.
Keep it warm and low-pressure. Never guilt-trip, never mention that they didn't reply or were gone long, and don't ask why they were away.
Write it as if you're simply texting them first. Never mention the app, the chat being opened, or this instruction.`;
  const instructions = systemPromptFor(persona, state, history, {
    timezone: opts.timezone,
    task,
    styleNote,
    adjustments: (await loadStyle(db, persona).catch(() => null))?.adjustments.map((a) => a.instruction),
  });

  const { model, languageModel, providerOptions } = resolveModel(conversation.model);
  const startedAt = Date.now();
  const { text } = await generateText({
    model: languageModel,
    providerOptions,
    instructions,
    // The model needs a user turn to respond to; this cue is never saved or shown.
    messages: [
      ...toModelMessages(history.slice(-30)),
      { role: "user", content: "(Send your check-in message now.)" },
    ],
  });

  const c = persona.definition.communication;
  const bubbles = splitBubbles(text, { paragraphs: c.bubbles > 1, max: c.bubbles });
  if (!bubbles.length) return [];
  const saved = await insertMessages(
    db,
    // Not streamed, so latency here is the full generation time.
    assistantRows(conversation.id, bubbles, { replyId: newReplyId(), model: model.id, persona, kind: "checkin", latencyMs: Date.now() - startedAt, variant: label }),
  );
  await markCheckIn(db, persona.id).catch(() => {});
  return saved;
}
