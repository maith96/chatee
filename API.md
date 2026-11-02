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
{ "default": "nova-smart",
  "models": [ { "id": "nova-smart", "name": "Nova Smart", "description": "..." }, ... ] }
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
                  "is_mine": false, "bio": "...", "role": "slow-burn romantic interest",
                  "age": 29, "pronouns": "she/her", "interests": ["old poetry", "rainy mornings"],
                  "multi_bubble": true } ] }
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
                { "id": "uuid", "role": "assistant", "content": "Hello!", "model": "terra-fast",
                  "kind": "reply", "reply_id": "uuid", ... } ],
  "feedback": [ { "reply_id": "uuid", "rating": 1, "reason": null } ] }
```
All bubbles of one assistant reply share a `reply_id`. Conversations also have `experiment` and `variant`
(a style test the chat is part of, or null); the server already applies it, including how many bubbles replies have. `feedback` holds your ratings of this chat's replies.

### `PATCH /conversations/{id}`
Body: `{ "title"?: string, "model"?: string }` → `{ "conversation": { ... } }`

### `DELETE /conversations/{id}`
→ `204 No Content`. Deletes its messages too.

### `POST /conversations/{id}/messages`
Sends a message and gets the AI's reply. The server keeps the history, so send only the new text.

Body:
```json
{ "content": "Explain black holes simply", "model": "nova-fast", "stream": false, "timezone": "Europe/London" }
```

`timezone` (optional, IANA name from the device) lets personas react to the user's local time, e.g. noticing it's late.

**`stream: false` (default)** waits for the full reply, then returns `201`:
```json
{ "user_message": { "id": "...", "role": "user", "content": "..." },
  "reply_id": "...",
  "assistant_messages": [ { "id": "...", "role": "assistant", "content": "WAIT" },
                          { "id": "...", "role": "assistant", "content": "you got the job??? 😭" } ] }
```
Persona replies can be **several chat bubbles**; each is its own message (also in `GET /conversations/{id}`).
Show them as separate bubbles, ideally with a short typing pause between them.

**`stream: true`** returns the reply as **plain text, streamed in chunks** as it's generated
(`Content-Type: text/plain`). For personas, bubbles are separated by a line containing only `|||`
(blank lines can also start a new bubble). The reply is saved when it finishes. Re-fetch the conversation for the saved IDs.
The `X-Reply-Id` response header gives the reply's id (for feedback).

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

**Safety:** if the message looks like the user may be in crisis, the JSON response includes
`crisis_support` (helplines to show, e.g. 988 in the US, Samaritans 116 123 in the UK), and streamed responses
include the header `X-Crisis-Support: 1`. Show these resources in your app whatever the persona replies.

**Retries:** if a reply fails, send the same `content` again. The server reuses the
unanswered message instead of saving a duplicate.

### `POST /conversations/{id}/checkin`
Call this when the user **opens a persona chat**. If they've been away long enough (per persona, e.g. 6–8 hours),
the persona texts first and the new messages are returned (`kind: "checkin"`); otherwise `messages` is empty.
Check-ins never stack: there's at most one until the user replies.
Body (optional): `{ "timezone": "Europe/London" }` → `{ "messages": [ ... ] }`

### `GET /personas/{id}/memories`
What this persona remembers about the user, and how close they are.
```json
{ "about_you": [ { "id": "uuid", "content": "Has a dog called Biscuit; vet appointment on Friday", "created_at": "..." } ],
  "about_them": [ { "id": "uuid", "content": "Has a sister who visits on weekends", "created_at": "..." } ],
  "relationship": { "stage": "new", "label": "Getting to know each other", "messages": 12, "since": "..." } }
```
Memories are learned automatically after each reply and are private to the user. Stages (`new` → `warm` → `close`)
need both enough messages and enough days, so they can't be rushed.

### `GET /personas/{id}/style`
How this persona has adapted its texting style to you:
`{ "personalize": true, "adjustments": [ { "id": "shorter", "label": "Shorter replies", "because": "You marked replies as too long 2 times." } ] }`

### `DELETE /personas/{id}/style`
Resets the adjustments for this persona (it starts learning again from now) → `204`.

### `PATCH /me`
`{ "personalize": false }` switches style adaptation off for all personas (default on). `GET /me` returns the setting.

### `GET /me/news?timezone=Africa/Nairobi`
News settings and what's been learned:
`{ "news": { "enabled": true, "regions": [], "topics": [], "home_region": "africa", "learned": { "topics": [ { "id": "sport", "engagement": 0.8, "mentions": 5 } ], "regions": [] } } }`
Empty `regions`/`topics` mean "automatic". Regions: `global, africa, asia, europe, uk, north_america, latin_america, middle_east, oceania`.
Topics: `world, politics, business, tech, science, health, sport, entertainment, culture, climate`.

### `PATCH /me/news`
`{ "enabled"?: boolean, "regions"?: [...], "topics"?: [...], "reset_learning"?: true }` → same shape as `GET`.
Send `timezone` with your message requests so personas know the user's region.

### `POST /news/refresh` (admins only)
Rebuilds the shared news digest now → `{ "status": "refreshed", "items": 45, "feeds": 98 }`.

### `DELETE /memories/{id}`
Forget one memory. → `204`

### `DELETE /personas/{id}/memories`
Make the persona forget everything about the user. → `204`

### `PUT /replies/{reply_id}/feedback`
Thumbs up/down on a persona reply (rates all its bubbles). Sending again changes the rating.
Body: `{ "rating": 1 | -1, "reason"?: "too_long" | "too_short" | "out_of_character" | "repetitive" | "too_much" | "other" }`
→ `{ "feedback": { "reply_id": "...", "rating": -1, "reason": "too_long" } }`. The reason is kept only with thumbs down.
Show the icons under the last bubble of each reply; they're always visible on the website.

### `DELETE /replies/{reply_id}/feedback`
Removes your rating → `204`.

### `GET /stats?days=30` (admins only)
Aggregate persona metrics: `{ "days": 30, "replies": [ ... ], "retention": [ ... ] }`, by persona, model and kind
(reply / check-in). Counts and averages only, no message text or user ids. Groups with fewer than 5 users have
`enough_data: false` and no metrics. Also `experiments`: per-variant counts for each style experiment. Others get `403 forbidden`.

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
