"use client";

import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "@/lib/chat-service";
import { DEFAULT_MODEL, type ModelId, type ModelInfo } from "@/lib/models";
import { activeVariant } from "@/lib/experiments";
import type { PersonaSummary } from "@/lib/personas";
import type { ContactView } from "@/lib/stranger-contacts";
import { signOut } from "@/app/login/actions";
import { Avatar } from "./avatar";
import { Logo, Wordmark } from "./logo";
import { MemoryPanel } from "./memory-panel";
import { SettingsPanel } from "./settings-panel";
import { ChatView } from "./chat-view";
import { ModelPicker } from "./model-picker";
import { PersonaProfile } from "./persona-profile";

// The website talks to the same /api/v1 endpoints your later app will use.
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

const timezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/** Shown next to every AI stranger, so nobody mistakes them for a real person. */
function AiBadge() {
  return <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">AI</span>;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ChatApp({ email, admin = false }: { email: string; admin?: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<ModelId>(DEFAULT_MODEL);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [personasLoaded, setPersonasLoaded] = useState(false);
  // For a new chat: undefined = still choosing, null = plain assistant, otherwise a persona.
  const [newChatPersona, setNewChatPersona] = useState<PersonaSummary | null | undefined>(undefined);
  const [showMemory, setShowMemory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // AI strangers the user has met. "request" ones wait in Message requests until the user replies.
  const [contacts, setContacts] = useState<ContactView[]>([]);
  const [meeting, setMeeting] = useState(false);
  const [meetError, setMeetError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setContacts((await api<{ contacts: ContactView[] }>("/strangers")).contacts);
    } catch {
      /* strangers not set up yet */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { conversations } = await api<{ conversations: Conversation[] }>("/conversations");
      setConversations(conversations);
      setListError(null);
    } catch (e) {
      setListError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    refresh();
    // Opening the app: a stranger may have texted (the server decides; at most one a day, never at night).
    api<{ contacts: ContactView[]; delivered: string | null; followed_up?: string | null }>("/strangers/sync", { method: "POST", body: JSON.stringify({ timezone: timezone() }) })
      .then((d) => {
        setContacts(d.contacts);
        if (d.delivered || d.followed_up) refresh();
      })
      .catch(() => {});
    // Only models whose provider has an API key on the server.
    api<{ default: ModelId; models: ModelInfo[] }>("/models")
      .then((data) => {
        setModels(data.models);
        setDefaultModel(data.default);
        setModel(data.default);
      })
      .catch(() => {});
    api<{ personas: PersonaSummary[] }>("/personas")
      .then((data) => setPersonas(data.personas))
      .catch(() => {})
      .finally(() => setPersonasLoaded(true));
  }, [refresh]);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const personaById = (id: string | null | undefined) =>
    id ? (personas.find((p) => p.id === id) ?? contacts.find((c) => c.persona.id === id)?.persona ?? null) : null;
  const contactByConversation = (id: string) => contacts.find((c) => c.conversation_id === id);
  const requests = contacts.filter((c) => c.state === "request" && c.conversation_id);
  // Message requests have their own list; ignored and blocked strangers' chats are hidden.
  const isRequestChat = (c: Conversation) => {
    const state = contactByConversation(c.id)?.state;
    return state === "request" || state === "ignored" || state === "blocked";
  };
  const activeContact = active ? contactByConversation(active.id) : undefined;
  const currentPersona = active ? personaById(active.persona_id) : (newChatPersona ?? null);
  // A chat in a style experiment may use a different number of bubbles than the persona normally does.
  const bubbles = active ? activeVariant(active.experiment, active.variant)?.style?.bubbles : undefined;
  const chatPersona = currentPersona && bubbles !== undefined ? { ...currentPersona, multi_bubble: bubbles > 1, max_bubbles: bubbles } : currentPersona;
  const choosing = !active && newChatPersona === undefined;

  function openConversation(c: Conversation) {
    setActiveId(c.id);
    setModel(models.some((m) => m.id === c.model) ? c.model : defaultModel);
    setPending(null);
    setSidebarOpen(false);
  }

  function newChat() {
    setActiveId(null);
    setPending(null);
    setNewChatPersona(undefined);
    setSidebarOpen(false);
  }

  function choosePersona(p: PersonaSummary | null) {
    setNewChatPersona(p);
    if (!p) setModel(defaultModel);
  }

  // First message of a new chat: create the conversation, then let ChatView send the text.
  async function startConversation(text: string) {
    // With a persona, let the server pick the persona's preferred model.
    const persona = newChatPersona ?? null;
    const { conversation } = await api<{ conversation: Conversation }>("/conversations", {
      method: "POST",
      body: JSON.stringify(persona ? { persona_id: persona.id } : { model }),
    });
    setModel(conversation.model);
    setConversations((list) => [conversation, ...list]);
    setPending({ id: conversation.id, text });
    setActiveId(conversation.id);
  }

  async function meetSomeone() {
    setMeeting(true);
    setMeetError(null);
    try {
      const { conversation } = await api<{ conversation: Conversation }>("/strangers/meet", {
        method: "POST",
        body: JSON.stringify({ timezone: timezone() }),
      });
      await Promise.all([refresh(), loadContacts()]);
      setConversations((list) => (list.some((x) => x.id === conversation.id) ? list : [conversation, ...list]));
      openConversation(conversation);
    } catch (e) {
      setMeetError((e as Error).message);
    } finally {
      setMeeting(false);
    }
  }

  async function respond(contact: ContactView, state: "ignored" | "blocked") {
    if (state === "blocked" && !window.confirm(`Block ${contact.persona.name}? They won't message you again.`)) return;
    await api(`/strangers/${contact.persona.id}`, { method: "PATCH", body: JSON.stringify({ state }) });
    // Their chat disappears from the lists; a blocked stranger never messages again.
    setContacts((list) => list.map((c) => (c.persona.id === contact.persona.id ? { ...c, state } : c)));
    if (activeId === contact.conversation_id) newChat();
  }

  async function rename(c: Conversation) {
    const title = window.prompt("Rename conversation", c.title)?.trim();
    if (!title || title === c.title) return;
    const { conversation } = await api<{ conversation: Conversation }>(`/conversations/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    setConversations((list) => list.map((x) => (x.id === c.id ? conversation : x)));
  }

  async function remove(c: Conversation) {
    if (!window.confirm(`Delete "${c.title}"? This can't be undone.`)) return;
    await api(`/conversations/${c.id}`, { method: "DELETE" });
    setConversations((list) => list.filter((x) => x.id !== c.id));
    if (activeId === c.id) newChat();
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-panel p-5 transition-transform duration-300 ease-out md:static md:translate-x-0 md:transition-none ${
          sidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}>
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <Wordmark className="text-xl" />
        </div>

        <button onClick={newChat}
          className="mb-6 flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left hover:bg-accent-soft">
          <span className="text-xl leading-none">+</span> New chat
        </button>
        <button onClick={meetSomeone} disabled={meeting}
          className="-mt-4 mb-2 flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left hover:bg-accent-soft disabled:opacity-60">
          <span className="text-xl leading-none">👋</span> {meeting ? "Finding someone…" : "Meet someone new"}
        </button>
        {meetError && <p className="mb-2 px-1 text-xs text-red-500">{meetError}</p>}
        <div className="mb-4" />

        {requests.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Message requests ({requests.length})</p>
            <div className="space-y-1">
              {requests.map((r) => (
                <button key={r.persona.id}
                  onClick={() => { const c = conversations.find((x) => x.id === r.conversation_id); if (c) openConversation(c); }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left ${r.conversation_id === activeId ? "bg-accent-soft" : "hover:bg-accent-soft/60"}`}>
                  <Avatar persona={r.persona} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate font-medium">{r.persona.name}</span><AiBadge /></div>
                    <div className="truncate text-xs text-muted">{r.preview?.content ?? "New message"}</div>
                  </div>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Recent</p>
        <nav className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {listError && <p className="px-2 text-sm text-red-500">{listError}</p>}
          {!listError && conversations.length === 0 && <p className="px-2 text-sm text-muted">No chats yet.</p>}
          {conversations.filter((c) => !isRequestChat(c)).map((c) => (
            <div key={c.id}
              className={`group flex items-center rounded-2xl ${c.id === activeId ? "bg-accent-soft" : "hover:bg-accent-soft/60"}`}>
              <button onClick={() => openConversation(c)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left">
                <Avatar persona={personaById(c.persona_id)} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{personaById(c.persona_id)?.name ?? c.title}</span>
                    {personaById(c.persona_id)?.is_stranger && <AiBadge />}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {personaById(c.persona_id) && c.title !== personaById(c.persona_id)?.name ? `${c.title} · ` : ""}{timeAgo(c.updated_at)}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 gap-1 pr-2 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                <IconButton label="Rename" onClick={() => rename(c)}>✎</IconButton>
                <IconButton label="Delete" onClick={() => remove(c)}>🗑</IconButton>
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 rounded-2xl border border-border p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Signed in
          </div>
          <div className="mt-1 truncate text-muted">{email}</div>
          <div className="mt-2 flex gap-4">
            <form action={signOut}>
              <button className="text-accent-ink hover:underline">Sign out</button>
            </form>
            <button onClick={() => setShowSettings(true)} className="text-accent-ink hover:underline">Settings</button>
            {admin && <a href="/admin/stats" className="text-accent-ink hover:underline">Stats</a>}
          </div>
          <p className="mt-3 text-xs text-muted">
            To improve personas we measure reply style and engagement (like reply length and thumbs up/down), not what you say, and try small style variations.
          </p>
        </div>
      </aside>
      <div
        className={`fixed inset-0 z-20 bg-black/20 transition-opacity duration-300 md:hidden ${sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-4 sm:py-4 md:px-8">
          <button className="rounded-lg p-2 md:hidden" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
          {currentPersona && !choosing ? (
            <button type="button" onClick={() => setProfileOpen(true)} aria-label={`View ${currentPersona.name}'s profile`}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left hover:opacity-80">
              <Avatar persona={currentPersona} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{currentPersona.name}</span>
                  {currentPersona.is_stranger && <AiBadge />}
                </div>
                {(currentPersona.tagline || currentPersona.city) && (
                  <div className="truncate text-xs text-muted">{[currentPersona.city, currentPersona.tagline].filter(Boolean).join(" · ")}</div>
                )}
              </div>
            </button>
          ) : (
            <div className="min-w-0 flex-1 truncate">
              <span className="hidden text-muted sm:inline">Workspace / </span>
              <span>{choosing ? "New chat" : (active?.title ?? "New conversation")}</span>
            </div>
          )}
          {currentPersona && !choosing && (
            <button onClick={() => setShowMemory(true)} title={`What ${currentPersona.name} remembers`}
              className="rounded-2xl border border-border bg-surface px-3 py-2 text-sm shadow-sm hover:border-accent">
              🧠<span className="ml-1 hidden sm:inline">Memory</span>
            </button>
          )}
          <span className="hidden text-sm text-muted sm:inline">Model</span>
          <ModelPicker value={model} models={models} onChange={setModel} />
        </header>

        {activeContact?.state === "request" && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent-soft/50 px-4 py-3 text-sm md:px-8">
            <span className="flex-1">
              <b>{activeContact.persona.name}</b> is an AI stranger who&apos;d like to chat. Reply to accept.
            </span>
            <button onClick={() => respond(activeContact, "ignored")} className="rounded-xl border border-border bg-surface px-3 py-1.5 hover:border-accent">Ignore</button>
            <button onClick={() => respond(activeContact, "blocked")} className="rounded-xl border border-border bg-surface px-3 py-1.5 text-red-500 hover:border-red-400">Block</button>
          </div>
        )}
        {choosing ? (
          <PersonaPicker personas={personas} loading={!personasLoaded} onChoose={choosePersona} />
        ) : (
        <ChatView
          key={activeId ?? `new-${newChatPersona?.id ?? "assistant"}`}
          conversationId={activeId}
          persona={chatPersona}
          pendingText={pending?.id === activeId ? pending.text : undefined}
          model={model}
          onStart={startConversation}
          onReplied={() => {
            refresh();
            if (activeContact?.state === "request") loadContacts(); // replying accepted the request
          }}
          onOpenProfile={() => setProfileOpen(true)}
        />
        )}
      </main>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showMemory && currentPersona && <MemoryPanel persona={currentPersona} onClose={() => setShowMemory(false)} />}
      {profileOpen && currentPersona && !choosing && <PersonaProfile persona={currentPersona} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function PersonaPicker({ personas, loading, onChoose }: { personas: PersonaSummary[]; loading: boolean; onChoose: (p: PersonaSummary | null) => void }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-2xl font-semibold">Who do you want to talk to?</h2>
        <p className="mt-2 text-center text-muted">Pick a character, or chat with the plain assistant.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {loading && [0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="flex animate-pulse items-start gap-4 rounded-3xl border border-border bg-surface p-4">
              <div className="h-24 w-24 shrink-0 rounded-full bg-border" />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <div className="h-5 w-1/3 rounded bg-border" />
                <div className="h-3.5 w-1/2 rounded bg-border" />
                <div className="h-3.5 w-full rounded bg-border" />
              </div>
            </div>
          ))}
          {personas.map((p) => (
            <button key={p.id} onClick={() => onChoose(p)}
              className="flex items-start gap-4 rounded-3xl border border-border bg-surface p-4 text-left transition hover:border-accent hover:shadow-sm">
              <Avatar persona={p} size="lg" />
              <div className="min-w-0 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{p.name}</span>
                  {p.is_romantic && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">romance</span>}
                </div>
                {p.tagline && <div className="text-sm text-muted">{p.tagline}</div>}
                {p.bio && <p className="mt-2 line-clamp-3 text-sm">{p.bio}</p>}
              </div>
            </button>
          ))}
          {!loading && <button onClick={() => onChoose(null)}
            className="flex items-center gap-4 rounded-3xl border border-dashed border-border p-4 text-left hover:border-accent">
            <Avatar persona={null} size="lg" />
            <div>
              <div className="text-lg font-semibold">Assistant</div>
              <div className="text-sm text-muted">Helpful answers, no character.</div>
            </div>
          </button>}
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}
      className="rounded-lg px-1.5 py-1 text-sm text-muted hover:bg-surface hover:text-text">
      {children}
    </button>
  );
}
