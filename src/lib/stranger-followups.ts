// Stranger follow-ups: a stranger the user has talked to texts again when the chat goes quiet.
// Rules (see ROADMAP.md):
//   - only strangers the user has written to (accepted contacts with at least one user message)
//   - after the stranger's own pace (eager ~1 day, steady 2-3 days, reserved 4-5 days) of quiet
//   - one unanswered follow-up, then nothing until the user replies (never stacked)
//   - not if the user has been silent in that chat for over 3 weeks
//   - at most one stranger follow-up a day across all strangers, never during the user's night
// Delivered when the user opens the app (POST /strangers/sync), written like a check-in.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConversation } from "./chat-service";
import { maybeCheckIn } from "./checkin";
import { defaultFollowUpPace, FOLLOW_UP_PACES, isFollowUpPace, type FollowUpPace } from "./opening-styles";
import type { Persona } from "./personas";

export const FOLLOW_UP_MAX_SILENCE_DAYS = 21;
const QUIET_FROM = 22;
const QUIET_UNTIL = 7;
const MAX_CHATS_CHECKED = 20;

export function followUpPaceOf(persona: Pick<Persona, "tags" | "definition">): FollowUpPace {
  const saved = persona.tags?.follow_up_pace;
  return isFollowUpPace(saved) ? saved : defaultFollowUpPace(persona.definition?.personality?.sliders);
}

type ChatState = {
  conversationId: string;
  pace: FollowUpPace;
  last: { role: string; kind: string | null; created_at: string } | null;
  lastUserAt: string | null;
};

/** Pure: which chat (if any) gets a follow-up now. Prefers the chat the user wrote in most recently. */
export function chooseFollowUp(chats: ChatState[], opts: { now?: number; sentToday: boolean; localHour: number | null }) {
  const now = opts.now ?? Date.now();
  if (opts.sentToday) return { pick: null, reason: "already one today" };
  if (opts.localHour === null) return { pick: null, reason: "unknown timezone" };
  if (opts.localHour >= QUIET_FROM || opts.localHour < QUIET_UNTIL) return { pick: null, reason: "night time" };
  const due = chats.filter((c) => {
    if (!c.last || !c.lastUserAt) return false; // the user never wrote to this stranger
    if (c.last.role !== "assistant" || c.last.kind === "checkin") return false; // their turn, or a follow-up is already waiting
    if (now - Date.parse(c.lastUserAt) > FOLLOW_UP_MAX_SILENCE_DAYS * 86_400_000) return false;
    return now - Date.parse(c.last.created_at) >= FOLLOW_UP_PACES[c.pace].hours * 3_600_000;
  });
  if (!due.length) return { pick: null, reason: "nobody due" };
  due.sort((a, b) => Date.parse(b.lastUserAt!) - Date.parse(a.lastUserAt!));
  return { pick: due[0], reason: null };
}

function localHour(tz?: string, now = Date.now()) {
  if (!tz) return null;
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(now)) % 24;
  } catch {
    return null;
  }
}

/** Called when the user opens the app: sends one stranger follow-up if one is due. Returns the conversation id or null. */
export async function followUpIfDue(db: SupabaseClient, timezone?: string, now = Date.now()) {
  const { data: contacts, error } = await db
    .from("stranger_contacts")
    .select("persona_id, conversation_id, state, created_at")
    .eq("state", "accepted")
    .not("conversation_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_CHATS_CHECKED);
  if (error || !contacts?.length) return null;
  const convIds = contacts.map((c) => c.conversation_id as string);

  // One follow-up a day across all strangers.
  const { data: recent } = await db
    .from("messages")
    .select("id")
    .in("conversation_id", convIds)
    .eq("kind", "checkin")
    .gte("created_at", new Date(now - 24 * 3_600_000).toISOString())
    .limit(1);
  const sentToday = !!recent?.length;
  const hour = localHour(timezone, now);
  if (sentToday || hour === null || hour >= QUIET_FROM || hour < QUIET_UNTIL) return null;

  const { data: personas } = await db.from("personas").select("id, tags, definition").in("id", contacts.map((c) => c.persona_id));
  const chats: ChatState[] = await Promise.all(
    contacts.map(async (c) => {
      const [last, lastUser] = await Promise.all([
        db.from("messages").select("role, kind, created_at").eq("conversation_id", c.conversation_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("messages").select("created_at").eq("conversation_id", c.conversation_id).eq("role", "user").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const p = (personas ?? []).find((x) => x.id === c.persona_id) as Pick<Persona, "tags" | "definition"> | undefined;
      return {
        conversationId: c.conversation_id as string,
        pace: p ? followUpPaceOf(p) : "steady",
        last: (last.data as ChatState["last"]) ?? null,
        lastUserAt: (lastUser.data?.created_at as string | undefined) ?? null,
      };
    }),
  );
  const { pick } = chooseFollowUp(chats, { now, sentToday, localHour: hour });
  if (!pick) return null;
  const conversation = await getConversation(db, pick.conversationId);
  if (!conversation) return null;
  const saved = await maybeCheckIn(db, conversation, { timezone, now, force: { afterHours: FOLLOW_UP_PACES[pick.pace].hours } });
  return saved.length ? conversation.id : null;
}
