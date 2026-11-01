import { assertUuid, authenticate, corsHeaders, errors, json, preflight, route } from "@/lib/api";
import { forgetPersona, getRelationship, listMemories, stageFor, STAGE_LABELS } from "@/lib/memory";
import { getPersona } from "@/lib/personas";

type Params = { id: string };

// GET /api/v1/personas/{id}/memories — what this persona remembers about you, and your relationship stage.
export const GET = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Persona");
  const { db } = await authenticate(req);
  if (!(await getPersona(db, id))) throw errors.notFound("Persona");
  const [memories, relationship] = await Promise.all([listMemories(db, id), getRelationship(db, id)]);
  const stage = stageFor(relationship);
  return json(req, {
    about_you: memories.user,
    about_them: memories.self,
    relationship: {
      stage,
      label: STAGE_LABELS[stage],
      messages: relationship?.user_messages ?? 0,
      since: relationship?.first_chat_at ?? null,
    },
  });
});

// DELETE /api/v1/personas/{id}/memories — make this persona forget everything about you.
export const DELETE = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Persona");
  const { db } = await authenticate(req);
  await forgetPersona(db, id);
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
