import { assertUuid, authenticate, corsHeaders, errors, preflight, route } from "@/lib/api";
import { deleteMemory } from "@/lib/memory";

// DELETE /api/v1/memories/{id} — forget one memory.
export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  assertUuid(id, "Memory");
  const { db } = await authenticate(req);
  if (!(await deleteMemory(db, id))) throw errors.notFound("Memory");
  return new Response(null, { status: 204, headers: corsHeaders(req) });
});

export const OPTIONS = preflight;
