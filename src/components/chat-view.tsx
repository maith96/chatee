"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { splitBubbles, stripPartialSeparator } from "@/lib/bubbles";
import { CRISIS_RESOURCES, detectCrisis } from "@/lib/crisis";
import type { Message } from "@/lib/chat-service";
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
const PERSONA_OPENERS = ["hey! 👋", "I need to vent", "tell me about yourself"];

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

type Props = {
  conversationId: string | null;
  persona: PersonaSummary | null;
  pendingText?: string;
  model: ModelId;
  onStart: (text: string) => Promise<void>;
  onReplied: () => void;
};

/** Loads a saved conversation, then hands it to ChatSession. With no id, shows the intro screen. */
export function ChatView(props: Props) {
  const { conversationId, pendingText } = props;
  const needsLoad = Boolean(conversationId && pendingText === undefined);
  const [initial, setInitial] = useState<UIMessage[] | null>(needsLoad ? null : []);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsLoad) return;
    fetch(`/api/v1/conversations/${conversationId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Could not load this chat.");
        setInitial(
          (data.messages as Message[]).map((m) => ({ id: m.id, role: m.role, parts: [{ type: "text", text: m.content }] })),
        );
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [conversationId, needsLoad]);

  if (loadError) return <Centered><p className="text-red-500">{loadError}</p></Centered>;
  if (!initial) return <Centered><Typing /></Centered>;
  return <ChatSession {...props} initialMessages={initial} />;
}

function ChatSession({
  conversationId,
  persona,
  pendingText,
  model,
  onStart,
  onReplied,
  initialMessages,
}: Props & { initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const savedIds = useMemo(() => new Set(initialMessages.map((m) => m.id)), [initialMessages]);
  const name = persona?.name ?? getModel(model).name;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Send only the new text; the server keeps the full history in Supabase.
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = [...messages].reverse().find((m) => m.role === "user");
          const text = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
          return { body: { conversationId, text, model: body?.model, timezone: timezone() } };
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, stop, error, regenerate, clearError } = useChat({
    id: conversationId ?? undefined,
    messages: initialMessages,
    transport,
    onFinish: () => onReplied(),
  });

  // Send the first message of a brand-new conversation once, right after it's created.
  const sentPending = useRef(false);
  useEffect(() => {
    if (pendingText && !sentPending.current) {
      sentPending.current = true;
      sendMessage({ text: pendingText }, { body: { model } });
    }
  }, [pendingText, sendMessage, model]);

  // Keep the newest message in view (also as paced bubbles appear).
  const bottomRef = useRef<HTMLDivElement>(null);
  const [revealTick, setRevealTick] = useState(0);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, revealTick]);

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
    clearError();
    sendMessage({ text }, { body: { model } });
  }

  const last = messages.at(-1);
  const lastHasText = last?.role === "assistant" && last.parts.some((p) => p.type === "text" && p.text.trim());
  const showTyping = status === "submitted" || starting || (pendingText && messages.length === 0) || (status === "streaming" && !lastHasText);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
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
            const live = !savedIds.has(m.id);
            return (
              <MessageBubbles
                key={m.id}
                message={m}
                persona={persona}
                // Saved bubbles are separate rows: only the first in a run gets the avatar.
                continued={prev?.role === m.role}
                live={live}
                streaming={live && streaming && i === messages.length - 1}
                onReveal={() => setRevealTick((t) => t + 1)}
              />
            );
          })}

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

      <div className="px-4 pb-4 md:px-8">
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
    </>
  );
}

function PersonaIntro({ persona, onPick }: { persona: PersonaSummary; onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <Avatar persona={persona} size="xl" />
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
  live,
  streaming,
  onReveal,
}: {
  message: UIMessage;
  persona: PersonaSummary | null;
  continued: boolean;
  live: boolean;
  streaming: boolean;
  onReveal: () => void;
}) {
  const raw = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
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
      <>
        <Row role="user">
          <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-accent px-5 py-3 text-white shadow-sm">{raw}</div>
        </Row>
        {detectCrisis(raw) && <SupportCard />}
      </>
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
      {/* "Typing…" while the next bubble is being written or paced in. */}
      {waitingForNext && (
        <Row role="assistant" persona={persona} hideAvatar={continued || visible.length > 0}><Typing /></Row>
      )}
    </div>
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
          <li key={r.region}>
            <span className="text-muted">{r.region}:</span>{" "}
            <a href={r.href} className="font-medium text-accent underline" target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {r.text}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">If you&apos;re in immediate danger, call your local emergency number.</p>
    </div>
  );
}

function AssistantBubble({ text, plain }: { text: string; plain: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group min-w-0 max-w-[85%]">
      <div className="rounded-3xl border border-border bg-surface px-5 py-3">
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
  return (
    <div className={`flex items-start gap-3 ${role === "user" ? "justify-end" : ""}`}>
      {role === "assistant" && (hideAvatar ? <div className="w-10 shrink-0" /> : <Avatar persona={persona} />)}
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
