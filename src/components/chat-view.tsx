"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "@/lib/chat-service";
import { getModel, type ModelId } from "@/lib/models";
import { Markdown } from "./markdown";

const STARTERS = [
  "Explain a tricky concept simply",
  "Help me write a friendly email",
  "Brainstorm 10 project ideas",
  "Plan a healthy week of meals",
];

type Props = {
  conversationId: string | null;
  pendingText?: string;
  model: ModelId;
  onStart: (text: string) => Promise<void>;
  onReplied: () => void;
};

/** Loads a saved conversation, then hands it to ChatSession. With no id, shows the welcome screen. */
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

function ChatSession({ conversationId, pendingText, model, onStart, onReplied, initialMessages }: Props & { initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Send only the new text; the server keeps the full history in Supabase.
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = [...messages].reverse().find((m) => m.role === "user");
          const text = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
          return { body: { conversationId, text, model: body?.model } };
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

  // Keep the newest message in view.
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, status]);

  const busy = status === "submitted" || status === "streaming" || starting;

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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && !busy && (
            <div className="pt-16 text-center">
              <h2 className="text-2xl font-semibold">How can I help today?</h2>
              <p className="mt-2 text-muted">Pick a starter or type anything below.</p>
              <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => submit(s)}
                    className="rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm hover:border-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => <Bubble key={m.id} message={m} />)}

          {(status === "submitted" ||
            starting ||
            (pendingText && messages.length === 0) ||
            (status === "streaming" && !messages.at(-1)?.parts.some((p) => p.type === "text" && p.text))) && (
            <Row role="assistant"><Typing /></Row>
          )}

          {(error || startError) && (
            <Row role="assistant">
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
            placeholder={`Message ${getModel(model).name}…`}
            className="w-full resize-none bg-transparent px-2 py-1 outline-none placeholder:text-muted"
          />
          <div className="flex items-center justify-end gap-3">
            <span className="hidden text-xs text-muted sm:inline">Enter to send · Shift + Enter for new line</span>
            {status === "submitted" || status === "streaming" ? (
              <button type="button" onClick={() => stop()} aria-label="Stop generating"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-text text-bg">■</button>
            ) : (
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40">↑</button>
            )}
          </div>
        </form>
        <p className="mt-2 text-center text-xs text-muted">AI can make mistakes. Check important info.</p>
      </div>
    </>
  );
}

function Bubble({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const [copied, setCopied] = useState(false);
  if (message.role === "user") {
    return (
      <Row role="user">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-accent px-5 py-3 text-white shadow-sm">{text}</div>
      </Row>
    );
  }
  if (!text) return null;
  return (
    <Row role="assistant">
      <div className="group min-w-0 max-w-[85%]">
        <div className="rounded-3xl border border-border bg-surface px-5 py-3"><Markdown text={text} /></div>
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="mt-1 px-2 text-xs text-muted opacity-0 hover:text-text group-hover:opacity-100 focus:opacity-100">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Row>
  );
}

function Row({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-3 ${role === "user" ? "justify-end" : ""}`}>
      {role === "assistant" && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-md" aria-hidden>🤖</div>
      )}
      {children}
    </div>
  );
}

function Typing() {
  return (
    <div className="typing flex gap-1 rounded-3xl border border-border bg-surface px-5 py-4" aria-label="Thinking">
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
