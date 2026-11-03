"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { joinBubbles, splitBubbles, stripPartialSeparator } from "@/lib/bubbles";
import { CRISIS_RESOURCES, detectCrisis } from "@/lib/crisis";
import type { Message } from "@/lib/chat-service";
import { FEEDBACK_REASONS, REASON_LABELS, type Feedback, type FeedbackReason } from "@/lib/feedback";
import { getModel, type ModelId } from "@/lib/models";
import type { PersonaSummary } from "@/lib/personas";
import { Avatar } from "./avatar";
import { Markdown } from "./markdown";

const ASSISTANT_STARTERS = [
  "Explain a tricky concept simply",
  "Help me write a friendly email",
  "Brainstorm 10 project ideas",
  "Plan a healthy week of meals",
];
/** How long a persona waits after your last bubble (or keystroke) before reading and replying. */
const REPLY_DELAY_MS = 3000;
const PERSONA_OPENERS = ["hey! 👋", "I need to vent", "tell me about yourself"];

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/** Lets any avatar in the chat open the persona's profile without threading a prop through every component. */
const ProfileContext = createContext<(() => void) | undefined>(undefined);

type Rate = (replyId: string, rating: 1 | -1 | null, reason?: FeedbackReason | null) => void;
/** Your ratings of this chat's replies, keyed by reply id, and how to change them. */
const FeedbackContext = createContext<{ ratings: Record<string, Feedback>; rate: Rate } | null>(null);

type Meta = { createdAt?: string; replyId?: string | null };
type Queued = { id: number; text: string; at: string };

const createdAtOf = (m: UIMessage) => (m.metadata as Meta | undefined)?.createdAt;
const replyIdOf = (m: UIMessage) => (m.metadata as Meta | undefined)?.replyId ?? undefined;
const textParts = (m: UIMessage) => m.parts.flatMap((p) => (p.type === "text" && p.text.trim() ? [p.text] : []));
function clock(iso: string | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Props = {
  conversationId: string | null;
  persona: PersonaSummary | null;
  pendingText?: string;
  model: ModelId;
  onStart: (text: string) => Promise<void>;
  onReplied: () => void;
  onOpenProfile?: () => void;
};

/** Loads a saved conversation, then hands it to ChatSession. With no id, shows the intro screen. */
export function ChatView(props: Props) {
  const { conversationId, pendingText } = props;
  const needsLoad = Boolean(conversationId && pendingText === undefined);
  const [initial, setInitial] = useState<UIMessage[] | null>(needsLoad ? null : []);
  const [initialFeedback, setInitialFeedback] = useState<Feedback[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsLoad) return;
    fetch(`/api/v1/conversations/${conversationId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Could not load this chat.");
        setInitial(
          (data.messages as Message[]).map((m) => ({
            id: m.id,
            role: m.role,
            parts: [{ type: "text", text: m.content }],
            metadata: { createdAt: m.created_at, replyId: m.reply_id },
          })),
        );
        setInitialFeedback((data.feedback as Feedback[] | undefined) ?? []);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [conversationId, needsLoad]);

  if (loadError) return <Centered><p className="text-red-500">{loadError}</p></Centered>;
  if (!initial) return <Centered><Typing /></Centered>;
  return <ChatSession {...props} initialMessages={initial} initialFeedback={initialFeedback} />;
}

function ChatSession({
  conversationId,
  persona,
  pendingText,
  model,
  onStart,
  onReplied,
  onOpenProfile,
  initialMessages,
  initialFeedback = [],
}: Props & { initialMessages: UIMessage[]; initialFeedback?: Feedback[] }) {
  const [input, setInput] = useState("");
  // Bubbles you've sent that the persona hasn't "read" yet; sent together once you pause.
  const [queue, setQueue] = useState<Queued[]>([]);
  const queueId = useRef(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const savedIds = useMemo(() => new Set(initialMessages.map((m) => m.id)), [initialMessages]);
  const name = persona?.name ?? getModel(model).name;

  const [ratings, setRatings] = useState<Record<string, Feedback>>(() =>
    Object.fromEntries(initialFeedback.map((f) => [f.reply_id, f])),
  );
  const feedback = useMemo(() => {
    const rate: Rate = (replyId, rating, reason = null) => {
      // Optimistic: update now, save in the background.
      setRatings((r) => {
        const next = { ...r };
        if (rating === null) delete next[replyId];
        else next[replyId] = { reply_id: replyId, rating, reason: rating === -1 ? reason : null };
        return next;
      });
      const url = `/api/v1/replies/${replyId}/feedback`;
      const save = () =>
        rating === null
          ? fetch(url, { method: "DELETE" })
          : fetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, reason }) });
      // A reply that just finished may still be saving: try once more shortly after.
      save()
        .then((res) => (res.status === 404 ? new Promise((r) => setTimeout(r, 1500)).then(save) : res))
        .catch(() => {});
    };
    return { ratings, rate };
  }, [ratings]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Send only the new text; the server keeps the full history in Supabase.
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = [...messages].reverse().find((m) => m.role === "user");
          const texts = last ? textParts(last) : [];
          return { body: { conversationId, texts, model: body?.model, timezone: timezone() } };
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, setMessages, status, stop, error, regenerate, clearError } = useChat({
    id: conversationId ?? undefined,
    messages: initialMessages,
    transport,
    onFinish: () => onReplied(),
  });

  // Send the first message of a brand-new conversation once, right after it's created.
  const sentPending = useRef(false);
  // useChat aborts its request when the component unmounts, and Strict Mode (dev) unmounts and
  // remounts once. Reset the guard on unmount so the remount sends again instead of never replying.
  useEffect(() => () => { sentPending.current = false; }, []);
  useEffect(() => {
    if (pendingText && !sentPending.current) {
      sentPending.current = true;
      sendMessage({ text: pendingText, metadata: { createdAt: new Date().toISOString() } }, { body: { model } });
    }
  }, [pendingText, sendMessage, model]);

  // Opening a persona chat after a quiet spell: the persona may text first (the server decides).
  const askedCheckIn = useRef(false);
  useEffect(() => {
    if (!conversationId || !persona || pendingText !== undefined || askedCheckIn.current) return;
    askedCheckIn.current = true;
    fetch(`/api/v1/conversations/${conversationId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: timezone() }),
    })
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then(({ messages: fresh }: { messages: Message[] }) => {
        if (!fresh?.length) return;
        // One live message holding all bubbles, so they're revealed with typing pauses.
        setMessages((current) => [
          ...current,
          {
            id: `checkin-${fresh[0].id}`,
            role: "assistant",
            parts: [{ type: "text", text: joinBubbles(fresh.map((m) => m.content)) }],
            metadata: { createdAt: fresh[0].created_at, replyId: fresh[0].reply_id },
          },
        ]);
        onReplied();
      })
      .catch(() => {});
  }, [conversationId, persona, pendingText, setMessages, onReplied]);

  // Keep the newest message in view (also as paced bubbles appear).
  const bottomRef = useRef<HTMLDivElement>(null);
  const [revealTick, setRevealTick] = useState(0);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, revealTick, queue.length]);

  // Wait for a pause (no new bubble or keystroke) before sending the queued bubbles as one request.
  useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => {
      setQueue([]);
      clearError();
      sendMessage(
        { parts: queue.map((q) => ({ type: "text" as const, text: q.text })), metadata: { createdAt: queue[0].at } },
        { body: { model } },
      );
    }, REPLY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [queue, input, model, sendMessage, clearError]);

  const streaming = status === "submitted" || status === "streaming";
  const busy = streaming || starting;

  async function submit(text: string) {
    text = text.trim();
    if (!text || busy) return;
    setInput("");
    if (!conversationId) {
      setStarting(true);
      setStartError(null);
      try {
        await onStart(text); // parent creates the conversation and remounts us with pendingText
      } catch (e) {
        setStartError((e as Error).message);
        setInput(text);
      } finally {
        setStarting(false);
      }
      return;
    }
    const at = new Date().toISOString();
    if (persona) {
      setQueue((q) => [...q, { id: queueId.current++, text, at }]);
      return;
    }
    clearError();
    sendMessage({ text, metadata: { createdAt: at } }, { body: { model } });
  }

  const last = messages.at(-1);
  const lastHasText = last?.role === "assistant" && last.parts.some((p) => p.type === "text" && p.text.trim());
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  const showTyping = status === "submitted" || starting || (pendingText && messages.length === 0) || (status === "streaming" && !lastHasText);

  return (
    <ProfileContext.Provider value={onOpenProfile}>
    <FeedbackContext.Provider value={feedback}>
      <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-4 md:px-8">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && !busy && (
            persona ? (
              <PersonaIntro persona={persona} onPick={submit} />
            ) : (
              <div className="pt-16 text-center">
                <h2 className="text-2xl font-semibold">How can I help today?</h2>
                <p className="mt-2 text-muted">Pick a starter or type anything below.</p>
                <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
                  {ASSISTANT_STARTERS.map((s) => (
                    <button key={s} onClick={() => submit(s)}
                      className="rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm hover:border-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const live = !savedIds.has(m.id);
            return (
              <MessageBubbles
                key={m.id}
                message={m}
                persona={persona}
                // Saved bubbles are separate rows: only the first in a run gets the avatar.
                continued={prev?.role === m.role}
                lastInRun={next?.role !== m.role && !(m.role === "user" && queue.length)}
                // A saved reply followed straight by a check-in: each gets its own time and rating.
                endOfReply={m.role === "assistant" && (next?.role !== "assistant" || replyIdOf(next) !== replyIdOf(m))}
                receipt={m.role === "user" && m.id === lastUserId && !queue.length ? (error ? "Not delivered" : "Read") : undefined}
                live={live}
                streaming={live && streaming && i === messages.length - 1}
                onReveal={() => setRevealTick((t) => t + 1)}
              />
            );
          })}

          {queue.length > 0 && (
            <div className="space-y-1.5">
              {queue.map((q) => <UserBubble key={q.id} text={q.text} />)}
              <Meta role="user">{clock(queue.at(-1)!.at)} · Sent</Meta>
            </div>
          )}

          {showTyping && <Row role="assistant" persona={persona}><Typing /></Row>}

          {(error || startError) && (
            <Row role="assistant" persona={persona}>
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {startError ?? readError(error)}
                {error && (
                  <button onClick={() => { clearError(); regenerate({ body: { model } }); }} className="ml-3 font-medium underline">Retry</button>
                )}
              </div>
            </Row>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="px-3 pb-4 sm:px-4 md:px-8">
        <form className="mx-auto max-w-3xl rounded-3xl border border-border bg-surface p-3 shadow-sm"
          onSubmit={(e) => { e.preventDefault(); submit(input); }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(input); }
            }}
            rows={Math.min(8, Math.max(2, input.split("\n").length))}
            placeholder={`Message ${name}…`}
            className="w-full resize-none bg-transparent px-2 py-1 outline-none placeholder:text-muted"
          />
          <div className="flex items-center justify-end gap-3">
            <span className="hidden text-xs text-muted sm:inline">Enter to send · Shift + Enter for new line</span>
            {streaming ? (
              <button type="button" onClick={() => stop()} aria-label="Stop generating"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-text text-bg">■</button>
            ) : (
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40">↑</button>
            )}
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-muted">
          {persona ? `${persona.name} is an AI character. Things they say aren't real facts.` : "AI can make mistakes. Check important info."}
        </p>
      </div>
    </FeedbackContext.Provider>
    </ProfileContext.Provider>
  );
}

function PersonaIntro({ persona, onPick }: { persona: PersonaSummary; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <Avatar persona={persona} size="xl" onClick={useContext(ProfileContext)} />
      <h2 className="mt-4 text-2xl font-semibold">{persona.name}</h2>
      {persona.tagline && <p className="mt-1 text-muted">{persona.tagline}</p>}
      {persona.bio && <p className="mt-4 max-w-md text-sm">{persona.bio}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {PERSONA_OPENERS.map((s) => (
          <button key={s} onClick={() => onPick(s)}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-accent">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/** How long a bubble "takes to type" before it appears, so replies feel paced like real texting. */
function typingDelay(text: string, first: boolean) {
  return first ? Math.min(900, 250 + text.length * 8) : Math.min(2200, 500 + text.length * 25);
}

/**
 * One message, shown as one or more chat bubbles. Live persona replies reveal their bubbles one at a
 * time with a typing pause between them. Saved history shows instantly.
 */
function MessageBubbles({
  message,
  persona,
  continued,
  lastInRun,
  endOfReply = false,
  receipt,
  live,
  streaming,
  onReveal,
}: {
  message: UIMessage;
  persona: PersonaSummary | null;
  continued: boolean;
  lastInRun: boolean;
  endOfReply?: boolean;
  receipt?: string;
  live: boolean;
  streaming: boolean;
  onReveal: () => void;
}) {
  const raw = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  // Messages saved earlier carry their time; live ones are stamped when they first appear.
  const [liveTime] = useState(() => new Date().toISOString());
  const time = clock(createdAtOf(message) ?? liveTime);
  const isPersonaReply = message.role === "assistant" && persona !== null;
  const bubbles = useMemo(() => {
    if (!isPersonaReply) return raw.trim() ? [raw] : [];
    const text = streaming ? stripPartialSeparator(raw) : raw;
    return splitBubbles(text, { paragraphs: persona.multi_bubble, max: persona.max_bubbles });
  }, [raw, isPersonaReply, streaming, persona]);

  // While streaming, the last bubble may still be growing; it's complete once a later one starts or the stream ends.
  const complete = streaming ? Math.max(0, bubbles.length - 1) : bubbles.length;
  const pace = live && isPersonaReply;
  const [shown, setShown] = useState(pace ? 0 : Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (!pace || shown >= complete) return;
    const timer = setTimeout(() => {
      setShown((n) => n + 1);
      onReveal();
    }, typingDelay(bubbles[shown] ?? "", shown === 0));
    return () => clearTimeout(timer);
  }, [pace, shown, complete, bubbles, onReveal]);

  const visible = pace ? bubbles.slice(0, shown) : bubbles;
  const waitingForNext = pace && (shown < bubbles.length || streaming);

  if (message.role === "user") {
    return (
      <div className="space-y-1.5">
        {textParts(message).map((text, i) => <UserBubble key={i} text={text} />)}
        {lastInRun && <Meta role="user">{[time, receipt].filter(Boolean).join(" · ")}</Meta>}
        {/* Help is always visible after a message that looks like a crisis, whatever the persona says. */}
        {detectCrisis(textParts(message).join("\n")) && <SupportCard />}
      </div>
    );
  }
  // No text at all yet: the chat-level typing indicator covers this.
  if (!bubbles.length) return null;

  return (
    <div className="space-y-1.5">
      {visible.map((text, i) => (
        <Row key={i} role="assistant" persona={persona} hideAvatar={continued || i > 0}>
          <AssistantBubble text={text} plain={isPersonaReply} />
        </Row>
      ))}
      {(lastInRun || endOfReply) && !waitingForNext && (
        <Meta role="assistant">
          {time}
          {isPersonaReply && replyIdOf(message) && <Rating replyId={replyIdOf(message)!} />}
        </Meta>
      )}
      {/* "Typing…" while the next bubble is being written or paced in. */}
      {waitingForNext && (
        <Row role="assistant" persona={persona} hideAvatar={continued || visible.length > 0}><Typing /></Row>
      )}
    </div>
  );
}

function Thumb({ down = false, active }: { down?: boolean; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill={active ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={down ? { transform: "scaleY(-1)" } : undefined}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" />
    </svg>
  );
}

/** Small thumbs up/down under a persona reply. Thumbs down offers optional reasons. */
function Rating({ replyId }: { replyId: string }) {
  const ctx = useContext(FeedbackContext);
  const [asking, setAsking] = useState(false);
  if (!ctx) return null;
  const current = ctx.ratings[replyId];
  const btn = "rounded-md p-1 hover:bg-panel hover:text-text";
  return (
    <>
      <span className="ml-2 inline-flex items-center gap-0.5 align-middle">
        <button type="button" aria-label="Good reply" aria-pressed={current?.rating === 1}
          className={`${btn} ${current?.rating === 1 ? "text-accent-ink" : ""}`}
          onClick={() => { setAsking(false); ctx.rate(replyId, current?.rating === 1 ? null : 1); }}>
          <Thumb active={current?.rating === 1} />
        </button>
        <button type="button" aria-label="Bad reply" aria-pressed={current?.rating === -1}
          className={`${btn} ${current?.rating === -1 ? "text-accent-ink" : ""}`}
          onClick={() => {
            const undo = current?.rating === -1;
            setAsking(!undo);
            ctx.rate(replyId, undo ? null : -1);
          }}>
          <Thumb down active={current?.rating === -1} />
        </button>
      </span>
      {asking && current?.rating === -1 && (
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="What was wrong?">
          {FEEDBACK_REASONS.map((r) => (
            <button key={r} type="button" aria-pressed={current.reason === r}
              onClick={() => { ctx.rate(replyId, -1, r); setAsking(false); }}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${current.reason === r ? "border-accent text-accent-ink" : "border-border hover:border-accent"}`}>
              {REASON_LABELS[r]}
            </button>
          ))}
          <button type="button" aria-label="Close" onClick={() => setAsking(false)} className="px-1 text-xs hover:text-text">✕</button>
        </span>
      )}
    </>
  );
}

/** Always shown after a message that looks like a crisis, so help is visible whatever the persona says. */
function SupportCard() {
  return (
    <div role="note" aria-label="Support resources"
      className="mx-auto max-w-md rounded-2xl border border-border bg-panel px-5 py-4 text-sm shadow-sm">
      <p className="font-medium">You don&apos;t have to go through this alone 💛</p>
      <p className="mt-1 text-muted">If you&apos;re struggling or not safe, please reach out to someone now:</p>
      <ul className="mt-2 space-y-1">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.href}>
            <span className="text-muted">{r.region}:</span>{" "}
            <a href={r.href} className="font-medium text-accent-ink underline" target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {r.text}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">If you&apos;re in immediate danger, call your local emergency number (999 or 112 in Kenya).</p>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <Row role="user">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-accent px-4 py-2.5 text-white sm:px-5 sm:py-3 shadow-sm">{text}</div>
    </Row>
  );
}

/** Small time / read-receipt line under the last bubble of a run. */
function Meta({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return <div className={`text-xs text-muted ${role === "user" ? "text-right" : "ml-10 sm:ml-[52px]"}`}>{children}</div>;
}

function AssistantBubble({ text, plain }: { text: string; plain: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group min-w-0 max-w-[85%]">
      <div className="rounded-3xl border border-border bg-surface px-4 py-2.5 sm:px-5 sm:py-3">
        {plain ? <p className="whitespace-pre-wrap break-words">{text}</p> : <Markdown text={text} />}
      </div>
      {!plain && (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="mt-1 px-2 text-xs text-muted opacity-0 hover:text-text group-hover:opacity-100 focus:opacity-100">
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

function Row({
  role,
  persona = null,
  hideAvatar = false,
  children,
}: {
  role: "user" | "assistant";
  persona?: PersonaSummary | null;
  hideAvatar?: boolean;
  children: React.ReactNode;
}) {
  const openProfile = useContext(ProfileContext);
  return (
    <div className={`flex items-start gap-2 sm:gap-3 ${role === "user" ? "justify-end" : ""}`}>
      {role === "assistant" && (hideAvatar ? <div className="w-8 shrink-0 sm:w-10" /> : <Avatar persona={persona} onClick={openProfile} />)}
      {children}
    </div>
  );
}

function Typing() {
  return (
    <div className="typing flex gap-1 rounded-3xl border border-border bg-surface px-5 py-4" aria-label="Typing">
      <span className="h-2 w-2 rounded-full bg-accent" /><span className="h-2 w-2 rounded-full bg-accent" /><span className="h-2 w-2 rounded-full bg-accent" />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 items-center justify-center p-8">{children}</div>;
}

/** Errors may arrive as plain text or as our API's JSON `{ error: { message } }`. */
function readError(error: Error | undefined) {
  if (!error) return "";
  try {
    return JSON.parse(error.message)?.error?.message ?? error.message;
  } catch {
    return error.message || "Something went wrong.";
  }
}
