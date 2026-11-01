# Persona API (v1)

A REST API for using Persona from any other app: mobile (React Native, Flutter, Swift, Kotlin), desktop, or another website.
The website uses this same API, so anything the site can do, your app can do.

Base URL: `https://<your-app>.vercel.app/api/v1`

## Authentication

Users sign in with **Supabase Auth** directly from your app, then send their access token with every request:

```
Authorization: Bearer <supabase access token>
```

Example (JavaScript / React Native, using `@supabase/supabase-js`):

```js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
await supabase.auth.signInWithPassword({ email, password });

const { data } = await supabase.auth.getSession();
const token = data.session.access_token; // supabase-js refreshes this automatically
```

Supabase has official SDKs for Flutter, Swift and Kotlin too. Use the same project URL and publishable key as the website.
Each user only ever sees their own data (enforced in the database by Row Level Security).

## Errors

All errors have the same shape:

```json
{ "error": { "code": "not_found", "message": "Conversation not found." } }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `bad_request` | Invalid body or parameters |
| 401 | `unauthorized` | Missing, invalid or expired token |
| 403 | `age_confirmation_required` | The user hasn't confirmed they're 18+ yet (see `POST /me/age`) |
| 404 | `not_found` | It doesn't exist, or it isn't yours |
| 429 | `rate_limited` | Too many messages per minute (default 15) |
| 502 | `generation_failed` | The AI provider failed (e.g. rate limit hit); safe to retry |
| 500 | `internal_error` | Unexpected server error |

## Endpoints

### `GET /models` (no auth needed)
Only models whose provider is configured on the server are listed.
```json
{ "default": "nova-fast",
  "models": [ { "id": "nova-fast", "name": "Nova Fast", "description": "..." }, ... ] }
```

### `GET /me`
```json
{ "user": { "id": "uuid", "email": "you@example.com", "created_at": "...", "adult_confirmed": true } }
```

### `POST /me/age`
Persona is 18+ only. Every other endpoint (except `/me` and `/models`) returns `403 age_confirmation_required`
until the user confirms. Body: `{ "birthdate": "YYYY-MM-DD" }` → `{ "adult_confirmed": true }`, or `400` if under 18.
Only the confirmation is stored, never the birthdate.

### `GET /personas`
Built-in and public personas, plus your own.
```json
{ "personas": [ { "id": "uuid", "name": "Elena", "tagline": "...", "avatar_url": "/avatars/elena.webp",
                  "avatar_emoji": "📚", "visibility": "public", "is_romantic": true, "is_builtin": true,
                  "is_mine": false, "bio": "...", "role": "slow-burn romantic interest" } ] }
```
Relative `avatar_url`s are on the same host as the API (e.g. `https://<your-app>.vercel.app/avatars/elena.webp`).

### `GET /personas/{id}`
One persona, including its full character sheet in `definition`.

### `GET /conversations?limit=50`
The newest first (max 100).
```json
{ "conversations": [ { "id": "uuid", "title": "Trip ideas", "model": "terra-fast",
                       "created_at": "...", "updated_at": "..." } ] }
```

### `POST /conversations`
Body (all optional): `{ "persona_id": "uuid", "title": "My chat", "model": "nova-smart" }` → `201`.
Without `model`, the persona's preferred model is used. Conversations include `persona_id`.
```json
{ "conversation": { "id": "uuid", "title": "New conversation", ... } }
```
The title is set automatically from the first message if you leave it as the default.

### `GET /conversations/{id}`
```json
{ "conversation": { ... },
  "messages": [ { "id": "uuid", "conversation_id": "uuid", "role": "user", "content": "Hi",
                  "model": null, "created_at": "..." },
                { "id": "uuid", "role": "assistant", "content": "Hello!", "model": "terra-fast", ... } ] }
```

### `PATCH /conversations/{id}`
Body: `{ "title"?: string, "model"?: string }` → `{ "conversation": { ... } }`

### `DELETE /conversations/{id}`
→ `204 No Content`. Deletes its messages too.

### `POST /conversations/{id}/messages`
Sends a message and gets the AI's reply. The server keeps the history, so send only the new text.

Body:
```json
{ "content": "Explain black holes simply", "model": "nova-fast", "stream": false }
```

**`stream: false` (default)** waits for the full reply, then returns `201`:
```json
{ "user_message": { "id": "...", "role": "user", "content": "..." },
  "assistant_message": { "id": "...", "role": "assistant", "content": "..." } }
```

**`stream: true`** returns the reply as **plain text, streamed in chunks** as it's generated
(`Content-Type: text/plain`). The reply is saved when it finishes. Re-fetch the conversation for the saved IDs.

```js
const res = await fetch(`${BASE}/conversations/${id}/messages`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ content: "Tell me a story", stream: true }),
});
if (!res.ok) throw new Error((await res.json()).error.message);

const reader = res.body.getReader();
const decoder = new TextDecoder();
let reply = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  reply += decoder.decode(value, { stream: true });
  render(reply); // update your UI as text arrives
}
```

> React Native's built-in `fetch` doesn't support streaming bodies. Use `stream: false`,
> or a streaming-capable fetch such as `expo/fetch` (Expo SDK 52+).

**Retries:** if a reply fails, send the same `content` again. The server reuses the
unanswered message instead of saving a duplicate.

## Quick test with curl

```bash
TOKEN="paste-an-access-token"
BASE="http://localhost:3000/api/v1"

ID=$(curl -s -X POST "$BASE/conversations" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}' | jq -r .conversation.id)

curl -N -X POST "$BASE/conversations/$ID/messages" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"content":"Hello!","stream":true}'
```

## Calling from another website (CORS)

Mobile and server apps need nothing extra. A **browser** app on a different domain must be listed in
`API_ALLOWED_ORIGINS` (comma-separated, e.g. `https://myother.app`).

## Versioning

Breaking changes will go to `/api/v2`. `/api/v1` will keep working, so apps already installed on phones don't break.
