"use client";

import { useCallback, useEffect, useState } from "react";
import type { Conversation } from "@/lib/chat-service";
import { DEFAULT_MODEL, type ModelId, type ModelInfo } from "@/lib/models";
import { signOut } from "@/app/login/actions";
import { Logo } from "./logo";
import { ChatView } from "./chat-view";
import { ModelPicker } from "./model-picker";

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

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ChatApp({ email }: { email: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; text: string } | null>(null);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<ModelId>(DEFAULT_MODEL);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    // Only models whose provider has an API key on the server.
    api<{ default: ModelId; models: ModelInfo[] }>("/models")
      .then((data) => {
        setModels(data.models);
        setDefaultModel(data.default);
        setModel(data.default);
      })
      .catch(() => {});
  }, [refresh]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  function openConversation(c: Conversation) {
    setActiveId(c.id);
    setModel(models.some((m) => m.id === c.model) ? c.model : defaultModel);
    setPending(null);
    setSidebarOpen(false);
  }

  function newChat() {
    setActiveId(null);
    setPending(null);
    setSidebarOpen(false);
  }

  // First message of a new chat: create the conversation, then let ChatView send the text.
  async function startConversation(text: string) {
    const { conversation } = await api<{ conversation: Conversation }>("/conversations", {
      method: "POST",
      body: JSON.stringify({ model }),
    });
    setConversations((list) => [conversation, ...list]);
    setPending({ id: conversation.id, text });
    setActiveId(conversation.id);
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
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-border bg-panel p-5 transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
        <div className="mb-6 flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold">Persona</span>
        </div>

        <button onClick={newChat}
          className="mb-6 flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-3 text-left hover:bg-accent-soft">
          <span className="text-xl leading-none">+</span> New chat
        </button>

        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted">Recent</p>
        <nav className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1">
          {listError && <p className="px-2 text-sm text-red-500">{listError}</p>}
          {!listError && conversations.length === 0 && <p className="px-2 text-sm text-muted">No chats yet.</p>}
          {conversations.map((c) => (
            <div key={c.id}
              className={`group flex items-center rounded-2xl ${c.id === activeId ? "bg-accent-soft" : "hover:bg-accent-soft/60"}`}>
              <button onClick={() => openConversation(c)} className="min-w-0 flex-1 px-4 py-3 text-left">
                <div className="truncate">{c.title}</div>
                <div className="text-xs text-muted">{timeAgo(c.updated_at)}</div>
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
          <form action={signOut}>
            <button className="mt-2 text-accent hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-4 md:px-8">
          <button className="rounded-lg p-2 md:hidden" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="min-w-0 flex-1 truncate">
            <span className="hidden text-muted sm:inline">Workspace / </span>
            <span>{active?.title ?? "New conversation"}</span>
          </div>
          <span className="hidden text-sm text-muted sm:inline">Model</span>
          <ModelPicker value={model} models={models} onChange={setModel} />
        </header>

        <ChatView
          key={activeId ?? "new"}
          conversationId={activeId}
          pendingText={pending?.id === activeId ? pending.text : undefined}
          model={model}
          onStart={startConversation}
          onReplied={refresh}
        />
      </main>
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
