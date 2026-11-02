import { json, preflight, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { MAX_IMPORT, templateFor } from "@/lib/stranger-template";

// GET /api/v1/admin/strangers/template?count=5 — a prompt to paste into another model (Claude, ChatGPT, Grok…).
// The people it asks for fill gaps in the pool; import the reply with POST /api/v1/admin/strangers/import.
export const GET = route(async (req) => {
  const { db } = await authenticateAdmin(req);
  const count = Math.min(MAX_IMPORT, Math.max(1, Math.round(Number(new URL(req.url).searchParams.get("count")) || 5)));
  return json(req, { template: await templateFor(db, count), count });
});

export const OPTIONS = preflight;
