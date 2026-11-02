# Persona roadmap

Ideas and decisions so far, so nothing gets lost. ✅ = shipped, 🔜 = next, 💡 = later.

## Shipped

- ✅ **Core app:** Next.js + Vercel AI SDK + Supabase on Vercel, versioned REST API (`/api/v1`, see `API.md`) for a future mobile app.
- ✅ **Models:** NVIDIA NIM (Nova Fast / Smart / Deep) with Gemini (Terra) as fallback. All built-in personas use Nova Smart.
- ✅ **18+ only:** date of birth at sign-up; only the confirmation is stored.
- ✅ **Personas:** structured character sheets (`personas/*.json`), human-like texting (multiple bubbles, typing pauses, read receipts, batching of quick texts), per-persona style, some romantic.
- ✅ **Built-in personas:** Juno, Elena, Cole, Lila, Miles, with AI-generated avatars.
- ✅ **Memory and relationship stages:** new → warm → close (needs both messages and days). Users can see and delete memories.
- ✅ **Check-ins (Phase A):** a persona texts first when the user reopens a chat after a quiet spell. Never stacked, never guilt-tripping, gentle after a crisis.
- ✅ **Safety:** crisis detection always shows helplines; under-18 statements are handled; platform rules can't be changed by personas.
- ✅ **Evals:** `npm run eval` plays scripted scenarios against the real models, with automatic checks and a judge model.
- ✅ **Learning from interaction** (analytics step 1): reply style metadata, 👍/👎 with reasons, `/admin/stats` (aggregates only, no message text, 5-user minimum, crisis excluded). Main measures are thumbs-up and day-7 return, not message volume.
- ✅ **Style experiments** (analytics step 2): A/B variants per new chat (`src/lib/experiments.ts`), results with 95% ranges. Running: `bubbles-v1` (usual bubbles vs one bubble).
- ✅ **Today's news** in conversations: shared digest from free RSS feeds, learned per-user regions and topics, user settings.
- ✅ **Per-user style** (analytics step 3): personas tune *how* they text to each user from 👎 reasons and how the user texts. Fixed list of style-only adjustments, visible in the Memory panel, resettable, can be switched off.

## ✅ Shipped: today's news in conversations (see README). Original plan below

Personas only know the world up to the model's training date. Give them fresh news to bring up naturally.

- **Sources:** free RSS feeds (e.g. BBC, Reuters, AP, the Guardian, plus tech/sport/science feeds). No paid API.
- **Digest:** a few times a day a fast model condenses headlines into about 15 short, neutral, dated items, each tagged with region and topic, stored in a `world_news` table. Refreshed lazily (on the first chat after it's stale), so no scheduler is needed.
- **In replies:** a `<world_today>` section with the 3–5 items most relevant to the persona and the user.
  - Mention news only when it fits.
  - Never invent details; say "only saw the headline" when unsure.
  - Be gentle with tragedies; don't push political opinions.
- **Global + regional, learned from engagement:**
  - Start from global news plus the region from the device timezone.
  - Track whether the user engages when a persona mentions an item (replies about it, writes more, keeps the topic going) and build per-user topic/region weights from that. Metadata only, resettable.
  - A setting lets the user choose regions/topics explicitly; it overrides the learning.

## ✅ Shipped: Strangers (AI people who message you first)

- ✅ Part 1: Stranger Studio (drafts that fill pool gaps, image prompts, photo upload, approval lifecycle)
- ✅ Part 2: message requests, "Meet someone new", strangers texting first (1/day, no nights, stop after 2 ignored), galleries, AI badges, settings switch
- ✅ Part 3: matching to similar users (Thompson sampling, 80/20 explore), diversity limits, leaderboard with suggestions and drift warnings

A WhatsApp-like experience where AI "strangers" DM the user to get to know them or just talk, and the user can also start a chat with a random new one.

### What a stranger is

- A persona with `kind: "stranger"`, using the same character sheet and validation as built-in personas (18+, safety limits).
- **Doesn't adapt** to the user's style (their fixed style is part of them), but **does remember** the user once they talk.
- **Always clearly labelled as AI** in the inbox and chat header.
- **Not flirty** (decided: off). A flirty opt-in might come later.

### Shared pool, not per-user

- Strangers come from a **shared pool**, so they can be quality-checked, kept affordable, and measured across users.
- Each user still has a private chat and private memories with each stranger.

### Images (about 20 a day, made by hand)

- Each stranger has a **base portrait plus variants** of the same person in a different place, outfit or moment.
- **Budget:** start with **10 strangers a day × 2 photos** (a pool of about 70 in a week). Alternative: 5 × 4.
- **Uses for variants:**
  - a profile gallery (tap the avatar)
  - later, photos the stranger "sends" in chat
- Only pre-made, reviewed images are ever shown or sent.
- Prompts must vary age (all clearly adult), ethnicity, pose, setting, lighting and framing, to avoid the "same girl with glasses, hand on chin" problem.
- 💡 Later: automatic per-stranger image generation, with the pool as fallback.
  - NVIDIA FLUX via the NIM key (free credits; it timed out when tested on 2026-11-02, so re-test later).
  - Gemini image generation (about $0.04 per image).
  - Store images in Supabase Storage.

### Stranger Studio (admin page)

1. The app drafts about 10 strangers a day: character sheet, tags (interests, vibe, region, age band) and ready-to-copy image prompts (base, then "same person, different scene").
2. The admin generates the images and uploads them on the draft.
3. The admin reviews (edit, reject or approve). Approved strangers go to trial.
4. ✅ **Drafting with a stronger model:** Nova's drafts came out generic, so the Studio also gives a ready-made template to paste into Claude, ChatGPT, Grok or another strong model, and imports the JSON it replies with. Each stranger records which model wrote it (`tags.generated_by`), and the stats page compares models.

### Lifecycle and matching

- **Status:** draft → trial → active → retired.
- **Choosing a stranger for a user:** filter by fit (shared interests, region, never shown to this user before), then rank by how well each stranger did with **similar users**.
- **Exploit/explore:** about **80% proven performers and 20% new or less-tested ones**, so new strangers get a fair chance.
- **Performance score** (healthy signals only): opener answered, chat reached 10+ messages, thumbs-up rate, came back within 7 days.
- **Leaderboard** on the stats page, overall and per group (same 5-user minimum and confidence ranges).
- 💡 Later: generate new strangers that resemble the top performers.

### Inbox and frequency

- **Chats** list plus **Message requests** for strangers who wrote first, with unread dots and a preview.
- Replying accepts a request; **Ignore** hides it; **Block** stops the stranger for good.
- **"Meet someone new"** button to start a chat with a random stranger.
- **Frequency (decided):** at most **one new stranger per day**, and none after the user ignores **2 in a row**. No messages during the user's night (timezone).
- A strangers on/off setting.
- First version: messages "arrive" when the user opens the app (like check-ins), no scheduler.
- **Openers** are specific: something from the stranger's life, a shared interest, or a news item.

### Guardrails

- Group users only by **interests, region and engagement style**, never by gender, ethnicity or looks.
- **Diversity limits** on what each user is shown, plus the exploration share, so the pool doesn't collapse onto a few "conventionally attractive" faces.
- Optimise for healthy engagement (thumbs, coming back), never for clinginess or volume.

## 💡 Later

- **Check-ins Phase B:** timed messages from a scheduler (Supabase pg_cron or Vercel Cron) plus push notifications; also used by strangers.
- **Persona creator and sharing:** users build their own personas (private, unlisted or public), with publish moderation and a report button.
- **Per-stranger image generation** (see above).
- **Juno copies her example lines:** evals keep flagging this; tune her examples or the prompt.
- **Mobile app** on top of `/api/v1`.

## Decisions log

| Date | Decision |
|---|---|
| 2026-11 | All built-in personas on Nova Smart |
| 2026-11 | Analytics: metadata only, 5-user minimum, crisis excluded; main measures are thumbs-up and day-7 return |
| 2026-11 | Experiments change style or model only, never romance, check-ins or safety |
| 2026-11 | Strangers: shared pool, about 20 hand-made images a day, not flirty, max 1 new stranger a day, stop after 2 ignored |
| 2026-11 | News: global + regional, learned from engagement, user can override |
