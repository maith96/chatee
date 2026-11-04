# Handoff: Sasamigo marketing session

Paste this file (or point the new session at it) to continue. Written 4 Nov 2026.

## The product
- **Sasamigo** by **Leinalok Labs** (Kenya). Repo: `maith96/chatee` (code still calls some things "persona").
- 18+ AI companion texting app. Next.js 16 + Vercel AI SDK + Supabase; models: NVIDIA NIM ("Nova") with Google
  Gemini ("Terra") fallback. Hosted on Vercel.
- Features: 5 built-in characters (Juno, Miles, Elena, Cole, Lila; some romantic), long-term memory the user can
  see/delete, relationship stages, check-ins (they text first), daily news incl. Kenya, per-user style learning,
  AI "strangers" who DM first (labelled AI, never flirty, max 1/day, never at night), crisis detection with
  Kenyan helplines first, account deletion, privacy policy + terms, landing page at `/`.
- Status: built and live-ready, **no users yet**, no beta numbers, no payments (M-Pesa planned), web only.

## Brand (decided, don't re-litigate)
- Name: Sasamigo = Swahili *sasa* ("hey") + *amigo*. Tagline: **"Friends who remember."**
- Positioning: friendship-led (not romance), Kenya / East Africa first, "always honestly AI", healthy engagement.
- Colours: Sasa Orange `#E8642C` (logo), button orange `#C2491A`, Deep Teal `#0F3D3E` / text `#12302F`,
  Cream `#FBF6EE`, Saffron `#F2B233` (small accents only). No blue.
- Logo: orange chat bubble, three typing dots + soft smile; wordmark "sasa" teal + "migo" orange
  (Nunito Black), tagline in Montserrat Bold. Files: `public/brand/` (SVG + PNG); generator `scripts/make-logo.py`.
- Domain: sasamigo.com was free on 3 Nov (not yet bought). Contact: hello@sasamigo.com (not yet set up).

## Done in the previous session
- Competitive brief: Character.AI, Replika, Nomi, Kindroid, Talkie, Chai, Pi, Meta AI (WhatsApp), Grok.
  Gaps: local Kenyan context, honesty, healthy-use design, friendship-first, Kenya pricing (M-Pesa).
  Threats: Meta AI in WhatsApp, category reputation, NY/CA companion laws (if ever in the US).
- Rebrand of the app (merged to main), landing page, legal pages, account deletion (merged to main).
- Pitch deck (15 slides incl. 4 backup slides, speaker notes = 2-min script):
  https://claude.ai/artifact/1GVD9uBFVggzoYhCgcZDAN (private; Slides artifact)
- Logo concepts canvas: https://claude.ai/artifact/Aj2LyEv2JgHy9gqVnr9d95
- `docs/pitch/judge-questions.md`: elevator pitch + 16 judge Q&As.
- `docs/pitch/applications-todo.md`: events/accelerators to-do + copy-paste application answers.
  (Branch `claude/wonderful-volta-vtsjvh`; the docs/pitch files are not yet on main.)

## Constraints and preferences
- Budget: **$20 total** for now (plan: domain ~$11, Gemini paid tier with a cap ~$3–5, later KES ~950
  business-name registration). No lawyer. Prefer free tools.
- The founder wants to pitch at events; Claude must not submit applications or sign up on their behalf.
- Never invent statistics; use [placeholders] for numbers the founder hasn't given.
- Before launch: switch Gemini off the free tier (the privacy policy promises providers don't train on chats);
  re-run `supabase/schema.sql`; make hello@ work (Cloudflare Email Routing, free).

## Suggested next marketing tasks
1. `/marketing:campaign-plan`: Nairobi closed-beta launch (20–50 users), friendship-led, ~$0 budget
   (TikTok clips of sweet/funny chats, campus ambassadors, WhatsApp sharing).
2. `/marketing:draft-content`: TikTok/Instagram scripts per character, landing-page tweaks, app-store text.
3. `/marketing:email-sequence`: onboarding emails for beta sign-ups.
4. `/marketing:brand-review`: check all copy against "honestly AI", no dependency/therapy claims.
5. Set reminders: 1 Feb 2027 Google for Startups Africa; ~1 Mar 2027 AI Everything Kenya Supernova exhibitor.
