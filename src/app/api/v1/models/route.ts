import { json, preflight, route } from "@/lib/api";
import { DEFAULT_MODEL, MODELS } from "@/lib/models";

// GET /api/v1/models — public; lists the models users can pick.
export const GET = route(async (req) =>
  json(req, {
    default: DEFAULT_MODEL,
    models: MODELS.map(({ id, name, description }) => ({ id, name, description })),
  }),
);
export const OPTIONS = preflight;
