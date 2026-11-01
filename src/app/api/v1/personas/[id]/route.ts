import { assertUuid, authenticate, errors, json, preflight, route } from "@/lib/api";
import { getPersona, summarize } from "@/lib/personas";

// GET /api/v1/personas/{id} — one persona with its full character sheet
// (works for public, unlisted-by-link, built-in and your own personas).
export const GET = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Persona");
  const { db, user } = await authenticate(req);
  const persona = await getPersona(db, id);
  if (!persona) throw errors.notFound("Persona");
  return json(req, { persona: { ...summarize(persona, user.id), definition: persona.definition } });
});
export const OPTIONS = preflight;
