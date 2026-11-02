# Persona

An AI chat app built with **Next.js + Vercel AI SDK + NVIDIA NIM and/or Gemini + Supabase**, hosted on Vercel.
It includes a **public REST API** (`/api/v1`) so a later app (mobile, desktop, another site) can use the same accounts and chats. See [API.md](./API.md).

**Features:** streaming replies · Markdown and code blocks with copy buttons · chats saved per user · auto-titled, renameable and deletable chats ·
model picker · starter prompts · stop and retry · friendly error messages · per-user rate limit · mobile layout · dark mode (follows the system setting).

## 1. Get your keys (free)

1. **AI provider (one or both):**
   - **NVIDIA NIM (fast):** https://build.nvidia.com → open any model → **Get API Key** (starts with `nvapi-`).
   - **Gemini (free tier):** https://aistudio.google.com → **Get API key**.
2. **Supabase:** create a project at https://supabase.com.
   - **SQL Editor:** paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
     Then do the same with [`supabase/personas-seed.sql`](./supabase/personas-seed.sql) to load the built-in personas.
     Both are safe to re-run, which is also how you upgrade after pulling new changes.
   - **Project Settings → API:** copy the **Project URL** and the **publishable** (or `anon`) key.
   - **Authentication → URL Configuration:** set **Site URL** to your app URL (e.g. `http://localhost:3000`, later your Vercel URL).

## 2. Run locally

```bash
cp .env.example .env.local   # then fill in the values
npm install
npm run dev
```

Open http://localhost:3000, sign up, and start chatting.
By default Supabase emails a confirmation link on sign-up. For quicker local testing you can turn off
**Authentication → Sign In / Providers → Email → Confirm email**.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On https://vercel.com, click **Add New → Project** and import the repository.
3. Add the same environment variables from `.env.local` (Settings → Environment Variables).
4. Deploy, then put the Vercel URL into Supabase's **Site URL** (and **Redirect URLs**).

## Project layout

```
src/
  app/
    page.tsx                         # chat page (requires sign-in)
    login/                           # sign in / sign up
    admin/stats/                     # persona stats (admins only)
    auth/callback/route.ts           # email confirmation links
    api/chat/route.ts                # streaming endpoint for the website UI
    api/v1/...                       # public REST API for other apps (see API.md)
  components/                        # chat UI (sidebar, messages, model picker, markdown)
  lib/
    chat-service.ts                  # shared chat logic: history, Gemini call, saving, rate limit
    models.ts                        # "Terra Fast" etc. → Gemini model IDs
    api.ts                           # API auth (Bearer token or cookie), errors, CORS
    reply-stats.ts, feedback.ts      # reply style metadata, thumbs up/down, admin stats
    supabase/                        # Supabase clients
  proxy.ts                           # keeps the login session fresh; redirects signed-out users
supabase/schema.sql                  # tables + Row Level Security
supabase/personas-seed.sql           # built-in personas (generated, don't edit)
personas/*.json                      # built-in persona character sheets (source of truth)
public/avatars/                      # built-in persona avatars
```

## Personas

Each persona is a structured character sheet (`src/lib/persona-schema.ts`): identity, personality,
behaviour rules, communication style with situational examples, knowledge, and relationship.
Built-in personas live in `personas/*.json`. After editing one:

```bash
npm run personas:seed   # validates the JSON and regenerates supabase/personas-seed.sql
```

Then run `supabase/personas-seed.sql` in the Supabase SQL Editor.

**Memory and check-ins:** after each reply, a fast model extracts lasting facts (about the user, and details the
persona said about itself) into `memories`; a grounding check drops anything that wasn't actually said. Users can see
and delete them via the 🧠 Memory button. `relationships` tracks how much they've talked; the stage
(new → warm → close) needs both messages and days. When a user reopens a persona chat after the persona's
`checkIn.afterHours`, the persona texts first (never stacked; gentle wellbeing check only if they were struggling).

**Safety layers:** crisis language and "I'm under 18" statements are detected in code and add an urgent instruction
to that reply; crisis messages also always show a helpline card in the UI (and `crisis_support` in the API).

### Learning from user interaction

Every reply is saved with style metadata (words, emoji, bubbles, whether it asks a question, time to the first word,
a `prompt_version` that changes when the persona or prompt builder changes) and a `reply_id` shared by its bubbles.
Users can rate replies with 👍 / 👎 (optional reason). Admins get a stats page at **`/admin/stats`** with, per persona
and model: thumbs-up rate, how often and how fast users answer, reply style, latency, day-1/day-7 return and messages
per session; check-ins are shown separately.

- Only metadata is used: the stats functions never read message text and return no user ids.
- Messages around a crisis (and the 24 hours after) are left out. Groups with fewer than 5 users show counts only.
- Main measures are **thumbs up** and **day-7 return**, not message volume, so we don't optimise for clinginess.
- Make yourself an admin once in the SQL Editor (see the bottom of `supabase/schema.sql`):
  `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`
- Bump `PROMPT_VERSION` in `src/lib/prompt-builder.ts` when you change the prompt layers.

**Today's news:** a shared digest (`news_items`) built from free RSS feeds (`src/lib/news-sources.ts`): a fast model
condenses about 100 headlines into about 45 neutral, tagged stories (topic, region, serious, political). It refreshes in the
background after a chat once it's 4+ hours old (or with **Refresh now** on `/admin/stats`). Each reply gets the 4 stories that
best fit the persona's interests and the user (home region from their timezone, plus what they've engaged with). Personas
bring one up about once every 6 messages (at most once per 3 hours per chat), never raise serious stories themselves, never
add details from memory, and don't take political sides; no news during a crisis. Users control it in **Settings** (on/off,
regions, topics, reset what's been learned). Setup: run `schema.sql` (v7), then copy the ingest key it creates into Vercel as
`NEWS_INGEST_KEY` (see the bottom of `schema.sql`). Only the server can write news.

**Per-user style:** each persona tunes how it texts to each user (`src/lib/personalize.ts`): shorter or more
detailed replies, more variety or a calmer tone from repeated 👎 reasons (2+), and briefer/fuller replies or fewer emoji
from how the user texts (10+ messages). Adjustments come from a fixed list and only touch style, never personality,
romance or safety, and they're skipped during a crisis. Users see them in the 🧠 Memory panel, can reset them per persona,
or switch "Adapt to my style" off for all personas.

**Style experiments (A/B tests)** live in `src/lib/experiments.ts`. Each new persona chat joins one variant of the first
active experiment for its persona (stable per chat; existing chats aren't moved). Variants may only change reply style
(length, bubbles, emoji, lowercase, a short style note) or the model, never romance, check-ins or safety rules.
The stats page compares each variant with the control (95% ranges, and "better/worse" only at p < 0.05 with 20+ samples).
To add one: write it in `experiments.ts`, check it with `npm run eval -- --variant <experiment>:<variant>`, deploy.
To stop one, set `active: false`: its chats go back to normal and its results stay on the stats page.

### Testing persona quality

```bash
npm run eval                          # all personas, 16 scenarios each
npm run eval -- juno --runs 2         # one persona, each scenario twice
npm run eval -- --model nova-fast     # try a different model
```

Plays scripted conversations (`evals/scenarios.json`, per-persona expectations in `evals/expectations/`) against the
real models, runs automatic checks (length, bubbles, style, honesty, crisis help, memory, copying examples) and a judge
model, and writes a review page to `evals/reports/latest.html`. Run it after changing a persona or the prompt builder.

**Rules enforced in the database:** every persona is 18+; users can only edit their own personas;
private personas are visible only to their owner; unlisted ones are viewable by link.
All app users must confirm they're 18+ (date of birth at sign-up; only the confirmation is stored).

## Customizing

- **Personas:** edit `personas/*.json` (see below). How a character sheet becomes a prompt: `src/lib/prompt-builder.ts`.
- **Plain assistant:** edit `SYSTEM_PROMPT` in `src/lib/chat-service.ts`.
- **Models:** edit `src/lib/models.ts`. NVIDIA models use IDs from https://build.nvidia.com; Gemini uses `-latest` aliases.
  A model only shows up if its provider's key is set. The default is Nova Smart (falls back to Gemini if there's no NVIDIA key).
- **Rate limit:** set `RATE_LIMIT_PER_MINUTE` (default 15 messages per user per minute).
- **Colors:** the CSS variables at the top of `src/app/globals.css`.

## Free-tier notes

- Gemini's free tier has per-minute and per-day limits, and Google may use free-tier prompts to improve its products. Don't send sensitive data.
- API keys stay on the server. Users never see them.
- NVIDIA's hosted NIM API is meant for development and prototyping, with per-key rate limits.
