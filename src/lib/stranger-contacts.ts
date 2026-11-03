// Strangers part 2: strangers who text users first, "Meet someone new", and message requests.
// Rules (see ROADMAP.md): at most one new stranger DM per day, fewer when the user leaves them unanswered
// (about 3 a week after 2 in a row, 1 a week after 4), and then strangers with opening styles the user
// hasn't ignored yet; none during the user's night; none on their first day; users can switch it off.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { splitBubbles } from "./bubbles";
import { createConversation, insertMessages, systemPromptFor, type Conversation, type Message } from "./chat-service";
import { isMissingSchema } from "./db-errors";
import { chooseStranger, loadPerformance, userSegment, type Candidate, type RecentContact } from "./stranger-matching";
import { getPersona, summarize, type Persona } from "./personas";
import { defaultOpeningStyle, isOpeningStyle, OPENING_STYLES, QUESTION_SHAPES, type OpeningStyle } from "./opening-styles";
import { partOfDay } from "./prompt-builder";
import { resolveModel } from "./providers";
import { assistantRows, newReplyId } from "./reply-stats";

export const CONTACT_STATES = ["request", "accepted", "ignored", "blocked"] as const;
export type ContactState = (typeof CONTACT_STATES)[number];
type Contact = {
  persona_id: string;
  conversation_id: string | null;
  origin: "dm" | "meet";
  state: ContactState;
  created_at: string;
  responded_at: string | null;
};

const UNANSWERED_HOURS = 48; // a request left this long counts as ignored
/** Hours between new stranger DMs, by how many the user has left unanswered in a row. */
export function dmGapHours(unanswered: number) {
  if (unanswered >= 4) return 168; // 1 a week
  if (unanswered >= 2) return 56; // about 3 a week
  return 24; // 1 a day
}
const MEET_PER_DAY = 5;
const QUIET_FROM = 22; // no stranger DMs between 22:00 and 07:00 local time
const QUIET_UNTIL = 7;
const NEW_ACCOUNT_HOURS = 12;

const CONTACT_FIELDS = "persona_id, conversation_id, origin, state, created_at, responded_at";

async function listContactRows(db: SupabaseClient) {
  const { data, error } = await db.from("stranger_contacts").select(CONTACT_FIELDS).order("created_at", { ascending: false });
  if (error && isMissingSchema(error)) return null; // schema v9 not run yet
  if (error) throw error;
  return data as Contact[];
}

async function strangersEnabled(db: SupabaseClient) {
  const { data, error } = await db.from("profiles").select("strangers_enabled").maybeSingle();
  if (error) return true;
  return (data?.strangers_enabled as boolean | undefined) ?? true;
}

function localHour(tz?: string, now = Date.now()) {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now)) % 24;
  } catch {
    return null;
  }
}

/** Why a stranger DM can't be sent now (or null if one is due). Pure, so it's easy to test. */
export function dmBlockedReason(
  contacts: Pick<Contact, "origin" | "state" | "created_at">[],
  opts: { enabled: boolean; userCreatedAt: string; timezone?: string; now?: number },
) {
  const now = opts.now ?? Date.now();
  if (!opts.enabled) return "switched off";
  if (now - Date.parse(opts.userCreatedAt) < NEW_ACCOUNT_HOURS * 3_600_000) return "new account";
  const hour = localHour(opts.timezone, now);
  if (hour === null || !opts.timezone) return "unknown timezone";
  if (hour >= QUIET_FROM || hour < QUIET_UNTIL) return "night time";
  const lastDm = contacts.find((c) => c.origin === "dm");
  const ignored = unansweredStreak(contacts, now).length;
  const gap = dmGapHours(ignored);
  if (lastDm && now - Date.parse(lastDm.created_at) < gap * 3_600_000) return gap === 24 ? "already had one today" : `slowed down (${ignored} unanswered in a row)`;
  return null;
}

/** Newest first: the DMs the user left unanswered, up to the first one they engaged with (or a stranger they met themselves). */
export function unansweredStreak<T extends Pick<Contact, "origin" | "state" | "created_at">>(contacts: T[], now = Date.now()) {
  const out: T[] = [];
  for (const c of contacts) {
    if (c.state === "accepted" || c.origin === "meet") break;
    const unanswered = c.state === "ignored" || c.state === "blocked" || (c.state === "request" && now - Date.parse(c.created_at) > UNANSWERED_HOURS * 3_600_000);
    if (!unanswered) break;
    out.push(c);
  }
  return out;
}

/**
 * Picks a stranger the user hasn't met (see stranger-matching.ts): mostly the ones that do best with
 * similar users, sometimes ones with little data yet, keeping each user's strangers varied.
 */
export async function pickStranger(
  db: SupabaseClient,
  opts: { exclude: Set<string>; recentIds: string[]; timezone?: string; rand?: () => number; avoidStyles?: Set<OpeningStyle> },
) {
  const { data, error } = await db
    .from("personas")
    .select("id, name, status, tags")
    .eq("kind", "stranger")
    .in("status", ["trial", "active"])
    .limit(500);
  if (error) throw error;
  const all = (data ?? []) as Candidate[];
  const unmet = all.filter((p) => !opts.exclude.has(p.id));
  if (!unmet.length) return null;
  // The user ignored strangers who said hi in these ways: try someone who opens differently.
  const fresh = opts.avoidStyles?.size ? unmet.filter((p) => !opts.avoidStyles!.has(openingStyleOf({ name: (p as Candidate & { name?: string }).name ?? "", tags: p.tags as Persona["tags"] }))) : unmet;
  const candidates = fresh.length ? fresh : unmet;
  const [{ segment, region }, rows] = await Promise.all([userSegment(db, opts.timezone), loadPerformance(db)]);
  // The user's latest strangers (newest first), for the diversity limits.
  const recentIds = opts.recentIds.slice(0, 3);
  const { data: recentData } = recentIds.length ? await db.from("personas").select("id, tags").in("id", recentIds) : { data: [] };
  const recent = recentIds.map((id) => ((recentData ?? []).find((p) => p.id === id)?.tags ?? {}) as RecentContact);
  const choice = chooseStranger(candidates, { rows: rows ?? [], segment, region, recent, rand: opts.rand });
  return choice ? { id: choice.id, segment, region, mode: choice.mode } : null;
}

/** The stranger's opening style (saved on the stranger, or a stable default for older ones). */
export function openingStyleOf(persona: Pick<Persona, "name" | "tags">): OpeningStyle {
  const saved = persona.tags?.opening_style;
  return isOpeningStyle(saved) ? saved : defaultOpeningStyle(persona.name, persona.tags?.region);
}

// Their saved openers aren't fed in: older drafts' openers were performative "bits", and the model copied
// their shape. Normal openers come from these rules, the stranger's opening style and texting style.
export const OPENER_TASK = (persona: Persona, part: string, style: OpeningStyle, shape: string) => `You're texting this person for the very first time. You just matched on the app and they haven't said anything yet. It's ${part} for them.
Open the way a normal person texts a new match: a greeting and one easy question about them. One short line.
Your way of saying hi: ${OPENING_STYLES[style].guide}.
Ask about ${shape}, in your own words.
Use your own capitalisation, emoji and slang habits. Don't open with a story, an observation, a complaint, a joke, a hot take or the news: nothing the person has to react to or work out.
No compliments on their looks, don't pretend you know them, and don't introduce yourself formally (${persona.name} is shown above your message).`;

/** Writes the stranger's first message into a new conversation. */
async function writeOpener(db: SupabaseClient, persona: Persona, conversation: Conversation, timezone?: string) {
  const shape = QUESTION_SHAPES[Math.floor(Math.random() * QUESTION_SHAPES.length)];
  const style = openingStyleOf(persona);
  const task = OPENER_TASK(persona, partOfDay(new Date(), timezone), style, shape);
  const instructions = systemPromptFor(persona, null, [], { timezone, task });
  const { languageModel, providerOptions, servedBy } = resolveModel(conversation.model);
  const { text } = await generateText({
    model: languageModel,
    providerOptions,
    instructions,
    messages: [{ role: "user", content: "(Send your first message now.)" }],
  });
  const c = persona.definition.communication;
  const bubbles = splitBubbles(text, { paragraphs: c.bubbles > 1, max: c.bubbles });
  if (!bubbles.length) throw new Error("The stranger's first message came back empty.");
  // The variant records which opener strategy was used, for comparing them later.
  return insertMessages(db, assistantRows(conversation.id, bubbles, { replyId: newReplyId(), model: servedBy().id, persona, kind: "opener", variant: `opener:${style}:${shape}` }));
}

/** Creates the chat with a stranger, their first message, and the contact row. */
async function startWithStranger(
  db: SupabaseClient,
  pick: { id: string; segment: string; region: string },
  origin: "dm" | "meet",
  timezone?: string,
) {
  const persona = await getPersona(db, pick.id);
  if (!persona) return null;
  const conversation = await createConversation(db, { persona, title: persona.name, model: persona.definition.settings.model as never });
  const messages = await writeOpener(db, persona, conversation, timezone).catch(async (err) => {
    await db.from("conversations").delete().eq("id", conversation.id); // don't leave an empty chat behind
    throw err;
  });
  const row = {
    persona_id: persona.id,
    conversation_id: conversation.id,
    origin,
    state: origin === "meet" ? "accepted" : "request",
    responded_at: origin === "meet" ? new Date().toISOString() : null,
  };
  // The user's group at the time, so performance can be measured per group (schema v10).
  let { error } = await db.from("stranger_contacts").insert({ ...row, segment: pick.segment, region: pick.region });
  if (error && isMissingSchema(error)) ({ error } = await db.from("stranger_contacts").insert(row));
  if (error) throw error;
  return { persona, conversation, messages };
}

export type ContactView = {
  persona: ReturnType<typeof summarize>;
  conversation_id: string | null;
  origin: "dm" | "meet";
  state: ContactState;
  created_at: string;
  preview: Pick<Message, "content" | "created_at" | "role"> | null;
};

/** The user's strangers with a preview of the latest message. Ignored/blocked ones are included (no preview) so apps can hide their chats. */
export async function listContacts(db: SupabaseClient, userId: string): Promise<ContactView[] | null> {
  const rows = await listContactRows(db);
  if (!rows) return null;
  const visible = rows;
  if (!visible.length) return [];
  const shown = (r: Contact) => r.state === "request" || r.state === "accepted";
  const [personas, previews] = await Promise.all([
    db.from("personas").select("*").in("id", visible.map((r) => r.persona_id)),
    Promise.all(
      visible.map((r) =>
        r.conversation_id && shown(r)
          ? db.from("messages").select("content, created_at, role").eq("conversation_id", r.conversation_id).order("created_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ),
    ),
  ]);
  if (personas.error) throw personas.error;
  return visible.flatMap((r, i) => {
    const p = (personas.data as Persona[]).find((x) => x.id === r.persona_id);
    if (!p) return [];
    return [{ persona: summarize(p, userId), conversation_id: r.conversation_id, origin: r.origin, state: r.state, created_at: r.created_at, preview: (previews[i].data as ContactView["preview"]) ?? null }];
  });
}

/** Called when the user opens the app: sends a stranger DM if one is due. */
export async function deliverIfDue(db: SupabaseClient, user: { id: string; created_at: string }, timezone?: string) {
  const rows = await listContactRows(db);
  if (!rows) return { delivered: null, reason: "not set up" };
  const reason = dmBlockedReason(rows, { enabled: await strangersEnabled(db), userCreatedAt: user.created_at, timezone });
  if (reason) return { delivered: null, reason };
  // Strangers the user left unanswered: their opening styles are avoided for the next one.
  const streak = unansweredStreak(rows);
  const avoidStyles = new Set<OpeningStyle>();
  if (streak.length) {
    const { data } = await db.from("personas").select("id, name, tags").in("id", streak.map((c) => c.persona_id));
    for (const p of data ?? []) avoidStyles.add(openingStyleOf(p as Pick<Persona, "name" | "tags">));
  }
  const pick = await pickStranger(db, { exclude: new Set(rows.map((r) => r.persona_id)), recentIds: rows.map((r) => r.persona_id), timezone, avoidStyles });
  if (!pick) return { delivered: null, reason: "no strangers available" };
  const started = await startWithStranger(db, pick, "dm", timezone);
  return { delivered: started ? started.persona.id : null, reason: started ? null : "stranger not found" };
}

/** "Meet someone new": a random stranger the user hasn't met, who says hi first. */
export async function meetSomeone(db: SupabaseClient, timezone?: string) {
  const rows = (await listContactRows(db)) ?? [];
  const today = rows.filter((r) => r.origin === "meet" && Date.now() - Date.parse(r.created_at) < 24 * 3_600_000).length;
  if (today >= MEET_PER_DAY) return { error: "limit" as const };
  const pick = await pickStranger(db, { exclude: new Set(rows.map((r) => r.persona_id)), recentIds: rows.map((r) => r.persona_id), timezone });
  if (!pick) return { error: "none" as const };
  const started = await startWithStranger(db, pick, "meet", timezone);
  return started ? { conversation: started.conversation, persona: started.persona } : { error: "none" as const };
}

export async function setContactState(db: SupabaseClient, personaId: string, state: ContactState) {
  const { data, error } = await db
    .from("stranger_contacts")
    .update({ state, responded_at: new Date().toISOString() })
    .eq("persona_id", personaId)
    .select(CONTACT_FIELDS)
    .maybeSingle();
  if (error) throw error;
  return data as Contact | null;
}

/** Replying to a message request accepts it. */
export async function acceptIfRequest(db: SupabaseClient, personaId: string) {
  const { error } = await db
    .from("stranger_contacts")
    .update({ state: "accepted", responded_at: new Date().toISOString() })
    .eq("persona_id", personaId)
    .eq("state", "request");
  if (error && !isMissingSchema(error)) throw error;
}

export async function setStrangersEnabled(db: SupabaseClient, userId: string, on: boolean) {
  const { error } = await db.from("profiles").upsert({ user_id: userId, strangers_enabled: on }, { onConflict: "user_id" });
  if (error) throw error;
}
export { strangersEnabled };
