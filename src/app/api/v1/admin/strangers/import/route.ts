import { errors, json, preflight, readJson, route } from "@/lib/api";
import { authenticateAdmin } from "@/lib/admin";
import { importStrangers } from "@/lib/stranger-template";

// POST /api/v1/admin/strangers/import  { "text": "<the model's reply>", "generated_by": "Claude Sonnet 5.5" }
// Saves each person in the reply as a draft, recording which model wrote it.
export const POST = route(async (req) => {
  const { db } = await authenticateAdmin(req);
  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text : "";
  const generatedBy = typeof body.generated_by === "string" ? body.generated_by.trim() : "";
  if (!text.trim()) throw errors.badRequest("Paste the model's reply in 'text'.");
  if (text.length > 200_000) throw errors.badRequest("That reply is too long.");
  if (!generatedBy) throw errors.badRequest("Say which model wrote it in 'generated_by'.");
  let result;
  try {
    result = await importStrangers(db, text, generatedBy);
  } catch (err) {
    throw errors.badRequest((err as Error).message);
  }
  return json(req, result, result.created.length ? 201 : 400);
});

export const OPTIONS = preflight;
