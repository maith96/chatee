import { json, preflight, route } from "@/lib/api";

// GET /api/v1 — a small, machine-readable index of the API.
export const GET = route(async (req) =>
  json(req, {
    name: "Sasamigo API",
    version: "v1",
    auth: "Send 'Authorization: Bearer <Supabase access token>'. See API.md.",
    endpoints: [
      "GET    /api/v1/models",
      "GET    /api/v1/me",
      "GET    /api/v1/conversations",
      "POST   /api/v1/conversations",
      "GET    /api/v1/conversations/{id}",
      "PATCH  /api/v1/conversations/{id}",
      "DELETE /api/v1/conversations/{id}",
      "POST   /api/v1/conversations/{id}/messages",
    ],
  }),
);
export const OPTIONS = preflight;
