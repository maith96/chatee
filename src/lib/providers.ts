// Server-only: turns a model entry into an AI SDK model, using whichever API keys are configured.
import { createGoogle } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { wrapLanguageModel, type LanguageModel, type streamText } from "ai";
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

/**
 * If a provider is out of capacity (rate limit, e.g. NVIDIA's 40 requests/minute, or a server error),
 * the same request goes to the matching model on the other provider instead of failing.
 */
const FALLBACK: Record<ModelId, ModelId> = {
  "nova-fast": "terra-lite",
  "nova-smart": "terra-fast",
  "nova-deep": "terra-pro",
  "terra-fast": "nova-smart",
  "terra-lite": "nova-fast",
  "terra-pro": "nova-deep",
};

/** Rate limited or overloaded: worth trying the other provider. */
export function isCapacityError(error: unknown) {
  const inner = (error as { lastError?: unknown })?.lastError ?? error;
  const status = (inner as { statusCode?: number })?.statusCode;
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  return /too many requests|rate.?limit|overloaded|unavailable|quota|exhausted/i.test(inner instanceof Error ? inner.message : String(inner));
}

function baseModel(model: ReturnType<typeof getModel>) {
  return model.provider === "google" ? google(model.providerModel) : nvidia.chatModel(model.providerModel);
}

/** Background jobs (memory extraction, news digest): Gemini's cheap model, so NVIDIA's limit is kept for live replies. */
export function backgroundModelId(): ModelId {
  return isProviderConfigured("google") ? "terra-lite" : "nova-fast";
}

/**
 * Resolves a requested model, falling back to the default if it isn't available here.
 * `servedBy()` tells you which model actually answered (it differs after a capacity fallback).
 */
export function resolveModel(id: string | null | undefined, { fallback = true }: { fallback?: boolean } = {}) {
  const wanted = getModel(id ?? defaultModelId());
  const model = isProviderConfigured(wanted.provider) ? wanted : getModel(defaultModelId());
  // Extra request-body fields for this model (sent as provider options; other providers ignore them).
  const extra = "body" in model ? model.body : undefined;
  const providerOptions: Parameters<typeof streamText>[0]["providerOptions"] = extra
    ? { [model.provider]: JSON.parse(JSON.stringify(extra)) }
    : undefined;

  const backup = getModel(FALLBACK[model.id]);
  let served = model;
  let languageModel: LanguageModel = baseModel(model);
  if (fallback && backup.provider !== model.provider && isProviderConfigured(backup.provider)) {
    const backupModel = baseModel(backup);
    const onCapacity = (error: unknown) => {
      if (!isCapacityError(error)) throw error;
      console.warn(`${model.id} is out of capacity; using ${backup.id} for this request.`);
      served = backup;
    };
    languageModel = wrapLanguageModel({
      model: baseModel(model),
      middleware: {
        specificationVersion: "v4",
        wrapStream: async ({ doStream, params }) => {
          try {
            return await doStream();
          } catch (error) {
            onCapacity(error);
            return backupModel.doStream(params);
          }
        },
        wrapGenerate: async ({ doGenerate, params }) => {
          try {
            return await doGenerate();
          } catch (error) {
            onCapacity(error);
            return backupModel.doGenerate(params);
          }
        },
      },
    });
  }
  return { model, languageModel, providerOptions, servedBy: () => served };
}
