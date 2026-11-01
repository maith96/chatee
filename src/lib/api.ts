// Helpers for the public, versioned API (/api/v1). Used by the website AND your later app.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ConfigError } from "./env";
import { createClient, createClientWithToken } from "./supabase/server";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: () => new ApiError(401, "unauthorized", "Sign in, or send a valid 'Authorization: Bearer <token>' header."),
  notFound: (what = "Resource") => new ApiError(404, "not_found", `${what} not found.`),
  badRequest: (message: string) => new ApiError(400, "bad_request", message),
  rateLimited: () => new ApiError(429, "rate_limited", "Too many messages. Please wait a minute."),
};

/** Works with a Bearer token (mobile/other apps) or the website's session cookie. */
export async function authenticate(req: Request): Promise<{ db: SupabaseClient; user: User }> {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    const db = createClientWithToken(token);
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) throw errors.unauthorized();
    return { db, user: data.user };
  }
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw errors.unauthorized();
  return { db, user: data.user };
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (process.env.API_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !(allowed.includes("*") || allowed.includes(origin))) return {};
  return {
    "Access-Control-Allow-Origin": allowed.includes("*") ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: Request, data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders(req) });
}

export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

type Handler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

/** Wraps a route: consistent `{ error: { code, message } }` responses and CORS on errors too. */
export function route<P = Record<string, never>>(handler: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return json(req, { error: { code: err.code, message: err.message } }, err.status);
      }
      console.error(err);
      if (err instanceof ConfigError) {
        return json(req, { error: { code: "server_misconfigured", message: err.message } }, 500);
      }
      return json(req, { error: { code: "internal_error", message: "Unexpected server error." } }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {}
  throw errors.badRequest("Request body must be a JSON object.");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(id: string, what = "Conversation") {
  if (!UUID.test(id)) throw errors.notFound(what);
}
