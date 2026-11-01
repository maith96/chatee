import { json, preflight, route } from "@/lib/api";
import { availableModels, defaultModelId } from "@/lib/providers";

// GET /api/v1/models — public; lists the models users can pick (only providers with a key set).
export const GET = route(async (req) =>
  json(req, {
    default: defaultModelId(),
    models: availableModels().map(({ id, name, description }) => ({ id, name, description })),
  }),
);
export const OPTIONS = preflight;
