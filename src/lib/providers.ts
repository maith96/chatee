// Server-only: turns a model entry into an AI SDK model, using whichever API keys are configured.
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { DEFAULT_MODEL, getModel, MODELS, type ModelId, type Provider } from "./models";

// Reads GOOGLE_GENERATIVE_AI_API_KEY. The base URL override is optional (proxies, testing).
const google = createGoogle({ baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL || undefined });

// NVIDIA NIM speaks the OpenAI API format.
const nvidia = createOpenAICompatible({
  name: "nvidia",
  baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
  includeUsage: true,
});

export function isProviderConfigured(provider: Provider) {
  if (provider === "google") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  return Boolean(process.env.NVIDIA_API_KEY);
}

/** Models whose provider has an API key on this server. */
export function availableModels() {
  return MODELS.filter((m) => isProviderConfigured(m.provider));
}

export function isModelAvailable(id: ModelId) {
  return isProviderConfigured(getModel(id).provider);
}

/** The default model, skipping providers without a key. */
export function defaultModelId(): ModelId {
  if (isModelAvailable(DEFAULT_MODEL)) return DEFAULT_MODEL;
  return availableModels()[0]?.id ?? DEFAULT_MODEL;
}

/** Resolves a requested model, falling back to the default if it isn't available here. */
export function resolveModel(id: string | null | undefined) {
  const wanted = getModel(id ?? defaultModelId());
  const model = isProviderConfigured(wanted.provider) ? wanted : getModel(defaultModelId());
  const languageModel = model.provider === "google" ? google(model.providerModel) : nvidia.chatModel(model.providerModel);
  return { model, languageModel };
}
