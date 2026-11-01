// Display names -> provider model IDs. Shared by the web UI and the public API.
// A model only shows up when its provider's API key is set on the server (see providers.ts).
export type Provider = "google" | "nvidia";

export const MODELS = [
  // NVIDIA NIM (https://build.nvidia.com) — fast hosted open models. Needs NVIDIA_API_KEY.
  // Speeds measured on the hosted API (time to first word). `body` adds extra request fields.
  {
    id: "nova-fast",
    name: "Nova Fast",
    description: "NVIDIA Nemotron 3.5 Lightning. Near-instant replies (~0.4s).",
    provider: "nvidia",
    providerModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
    // Reasoning model: with thinking on it can spend the whole reply thinking. Off = fast, direct answers.
    body: { chat_template_kwargs: { enable_thinking: false } },
  },
  {
    id: "nova-smart",
    name: "Nova Smart",
    description: "NVIDIA Nemotron 3 Ultra (550B). Stronger answers, still quick (~2.5s).",
    provider: "nvidia",
    providerModel: "nvidia/nemotron-3-ultra-550b-a55b",
    body: { chat_template_kwargs: { enable_thinking: false } },
  },
  {
    id: "nova-deep",
    name: "Nova Deep",
    description: "MiniMax M3.1 Flash. Thinks before answering, for hard questions (~3-10s).",
    provider: "nvidia",
    providerModel: "minimaxai/minimax-m3.1-flash",
  },
  // Google Gemini (free tier). Needs GOOGLE_GENERATIVE_AI_API_KEY.
  // "-latest" aliases always point at Google's current model, so they don't go stale.
  {
    id: "terra-fast",
    name: "Terra Fast",
    description: "Gemini Flash. Capable answers for everyday chat.",
    provider: "google",
    providerModel: "gemini-flash-latest",
  },
  {
    id: "terra-lite",
    name: "Terra Lite",
    description: "Gemini Flash-Lite. Lightest Gemini, highest free limits.",
    provider: "google",
    providerModel: "gemini-flash-lite-latest",
  },
  {
    id: "terra-pro",
    name: "Terra Pro",
    description: "Gemini Pro. Best Gemini reasoning, lower free limits.",
    provider: "google",
    providerModel: "gemini-pro-latest",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  description: string;
  provider: Provider;
  providerModel: string;
  body?: Record<string, unknown>;
}[];

export type ModelId = (typeof MODELS)[number]["id"];
export type ModelInfo = { id: ModelId; name: string; description: string };

/** First choice when nothing is selected; the server falls back further if its key is missing. */
export const DEFAULT_MODEL: ModelId = "nova-smart";

export function getModel(id: string | null | undefined) {
  return MODELS.find((m) => m.id === id) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}

export function isModelId(id: unknown): id is ModelId {
  return typeof id === "string" && MODELS.some((m) => m.id === id);
}
