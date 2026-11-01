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
    auth/callback/route.ts           # email confirmation links
    api/chat/route.ts                # streaming endpoint for the website UI
    api/v1/...                       # public REST API for other apps (see API.md)
  components/                        # chat UI (sidebar, messages, model picker, markdown)
  lib/
    chat-service.ts                  # shared chat logic: history, Gemini call, saving, rate limit
    models.ts                        # "Terra Fast" etc. → Gemini model IDs
    api.ts                           # API auth (Bearer token or cookie), errors, CORS
    supabase/                        # Supabase clients
  proxy.ts                           # keeps the login session fresh; redirects signed-out users
supabase/schema.sql                  # tables + Row Level Security
```

## Customizing

- **Personality:** edit `SYSTEM_PROMPT` in `src/lib/chat-service.ts`.
- **Models:** edit `src/lib/models.ts`. NVIDIA models use IDs from https://build.nvidia.com; Gemini uses `-latest` aliases.
  A model only shows up if its provider's key is set. The default is Nova Fast (falls back to Gemini if there's no NVIDIA key).
- **Rate limit:** set `RATE_LIMIT_PER_MINUTE` (default 15 messages per user per minute).
- **Colors:** the CSS variables at the top of `src/app/globals.css`.

## Free-tier notes

- Gemini's free tier has per-minute and per-day limits, and Google may use free-tier prompts to improve its products. Don't send sensitive data.
- API keys stay on the server. Users never see them.
- NVIDIA's hosted NIM API is meant for development and prototyping, with per-key rate limits.
