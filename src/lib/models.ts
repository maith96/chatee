// Display names -> Gemini model IDs. Shared by the web UI and the public API.
// "-latest" aliases always point at Google's current model, so they don't go stale.
export const MODELS = [
  {
    id: "terra-fast",
    name: "Terra Fast",
    description: "Quick, capable answers for everyday chat.",
    gemini: "gemini-flash-latest",
  },
  {
    id: "terra-lite",
    name: "Terra Lite",
    description: "Fastest and lightest. Highest free-tier limits.",
    gemini: "gemini-flash-lite-latest",
  },
  {
    id: "terra-pro",
    name: "Terra Pro",
    description: "Best reasoning. Lower free-tier limits (may need billing).",
    gemini: "gemini-pro-latest",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];
export const DEFAULT_MODEL: ModelId = "terra-fast";

export function getModel(id: string | null | undefined) {
  return MODELS.find((m) => m.id === id) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}

export function isModelId(id: unknown): id is ModelId {
  return typeof id === "string" && MODELS.some((m) => m.id === id);
}
