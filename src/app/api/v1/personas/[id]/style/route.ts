import { assertUuid, authenticate, corsHeaders, errors, json, preflight, route } from "@/lib/api";
import { getPersona } from "@/lib/personas";
import { loadStyle, resetStyle } from "@/lib/personalize";

type Params = { id: string };

// GET /api/v1/personas/{id}/style — how this persona has adapted its style to you, and why.
export const GET = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Persona");
  const { db } = await authenticate(req);
  const persona = await getPersona(db, id);
  if (!persona) throw errors.notFound("Persona");
  const { personalize, adjustments } = await loadStyle(db, persona);
  return json(req, {
    personalize,
    adjustments: adjustments.map(({ id, label, because }) => ({ id, label, because })),
  });
});

// DELETE /api/v1/personas/{id}/style — forget the adjustments; start learning again from now.
export const DELETE = route<Params>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Persona");
  const { db } = await authenticate(req);
  await resetStyle(db, id);
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
