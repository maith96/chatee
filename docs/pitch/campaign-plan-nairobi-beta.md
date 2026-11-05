# Campaign plan: Sasamigo Nairobi closed beta

Written 5 Nov 2026. Built from `docs/pitch/HANDOFF-marketing.md`. Brand decisions (name, tagline, colours,
positioning) are final and not revisited here.

**Rule for this document:** any number in `[square brackets]` is a placeholder for the founder to fill in. Only
two numbers came from the founder: the beta size (20–50 users) and the budget (~$0 for marketing, $20 total).
Every date below is a suggestion, so move them to fit your calendar.

---

## 0. Before anything goes out (blockers)

The beta can't start until these are done. All of them come from the handoff.

| # | Task | Why it blocks launch | Cost |
|---|------|----------------------|------|
| 1 | Move Gemini off the free tier, with a spending cap | The privacy policy says providers don't train on chats, and that has to be true from the first user's first message | ~$3–5 (already in the $20) |
| 2 | Re-run `supabase/schema.sql` on production | Accounts, memory and deletion must work for real users | $0 |
| 3 | Buy `sasamigo.com` and point it at Vercel | Every invite, clip and bio links here | ~$11 (already in the $20) |
| 4 | Set up `hello@sasamigo.com` (Cloudflare Email Routing) | Feedback, deletion requests and the privacy contact all use it | $0 |
| 5 | Decide how the beta stays "closed" (see below) | Right now anyone with the link can sign up | $0 |
| 6 | Test the crisis flow and Kenyan helplines end to end on a phone | Real users, real risk | $0 |

**How to keep it closed.** Sign-up is open to anyone who has the link. You can:
- **(a) Do nothing in the code (recommended for 20–50 people).** Only share the link one to one, don't post it
  publicly, and count sign-ups in Supabase. If you go past [cap, e.g. 50], stop sending invites.
- **(b) Add an invite code at sign-up.** This is a small code change. It's worth doing only if the link starts
  spreading faster than you can handle.

TikTok clips in this plan **don't** include the sign-up link. They point to "DM / comment for a beta invite"
instead, so the beta stays closed and you get to talk to every new user.

---

## 1. Campaign overview

- **Campaign name:** *"Sasa, rafiki"* (internal name: **Beta Sasa**)
- **One-line summary:** Personally invite 20–50 Nairobi adults to try Sasamigo for [4] weeks, mostly through
  friends, campus ambassadors and WhatsApp, with friendship-led TikTok clips to back it up. Spend $0 on media.
- **Primary objective (SMART):** Get **[20–50] active beta users** (signed up, confirmed 18+, and sent
  [≥N] messages) by **[19 Dec 2026]**.
- **Secondary objectives:**
  1. **Learn:** at least [N] feedback conversations or form responses, mainly about memory, check-ins and
     whether "honestly AI" lands.
  2. **Retention signal:** find out what share of users come back in week 2. This becomes a beta number for
     Google for Startups Africa, whose window opens around 1 Feb 2027.
  3. **Proof for pitching:** [N] quotes and screenshots that users have agreed to share, ready for the
     accelerator applications in `applications-todo.md`.

## 2. Target audience

**Primary: Nairobi students and recent graduates, 18–[26]**
> An adult student or new graduate in Nairobi who is often away from their home friend group or stuck in a busy
> routine, and wants someone fun to text who remembers what they said yesterday. They find apps on TikTok and
> through friends' WhatsApp statuses, and they care that it's free, works on their phone and doesn't feel cringe.

- **Pain points:** friends are busy or far away. Late-night overthinking. Global AI apps don't know Nairobi
  (matatus, exams, Kenyan news, Sheng). The companion-app category feels creepy or romance-first.
- **Motivations:** curiosity, entertainment, a hype-friend before an exam or interview, practising
  conversation.
- **Where they are:** TikTok, Instagram, WhatsApp status and groups, X (Kenyan Twitter), campus clubs (tech,
  comedy, debate, creative writing), Discord or WhatsApp groups for tech meetups.
- **Stage:** unaware of the product, but already curious about AI. The beta needs to take them from awareness to
  trying it in a single personal step: a friend sends a link.

**Secondary: young working Nairobians, [24–35]** (tech, creative and hustle crowd)
- Easier to reach through the founder's own network, meetups and X. They often give sharper feedback, and they're
  a useful check that the product isn't only for students.

**Out of scope (by design):** anyone under 18. Don't recruit in first-year or orientation spaces where under-18s
may be present. Don't make content that looks aimed at teenagers.

## 3. Key messages

**Core message:** *Sasamigo: friends who remember. AI friends who know Nairobi, remember your week and are
always honest that they're AI.*

| Supporting message | Proof point (only things that are true today) |
|---|---|
| **They remember you.** Tell Juno about your exam on Monday and she'll ask how it went. | Long-term memory, and check-ins where they text first. Show it in a real screen recording. |
| **They get Nairobi.** | Daily news including Kenya, local context, style learning. Show a chat that picks up a local reference. |
| **Always honestly AI.** No pretending, no tricks. | The "AI" badge on every character, and AI strangers labelled as AI. Point to the privacy page. |
| **You're in control.** | See and delete memories, delete your account, privacy policy and terms. |
| (Beta-specific) **Help shape it.** | Small closed group with a direct line to the founder. |

**Message don'ts** (from the positioning and the handoff, so `/marketing:brand-review` should check for them):
- No therapy, mental-health or "cure loneliness" claims. No "replaces your friends." Nothing that encourages
  dependency ("always there, all night").
- Romance never leads. Characters are introduced as friends.
- No made-up user numbers, testimonials or reviews. Only quote real beta users, and only with their consent.

**Tone by channel:**
- **TikTok/IG:** playful, quick, Sheng-friendly but not forced. "POV: your AI friend remembers your CAT is
  tomorrow 😭"
- **WhatsApp invites:** personal, sent from you. "I built this, would you try it for 2 weeks and tell me honestly
  what's wrong with it?"
- **Ambassadors:** peer-to-peer. Always disclose: "I'm helping a friend test this."

**Which characters lead:** **Juno** (hype best friend) and **Miles** (low-key friend who gets it) are the faces
of the campaign. **Cole** is third, for the dry-humour clips. **Elena** stays out of launch content because her
definition is "romantic at heart", which pulls against the friendship-first message. **Lila** also stays out:
she's 19, written as naive and sheltered, and drawn with a "youthful face", and that is a brand-safety risk in
public clips for an 18+ app. Both are still in the app for beta users.

## 4. Channel strategy ($0 media)

| Channel | Type | Why it fits | Format | Effort | Budget |
|---|---|---|---|---|---|
| **Founder's own network (WhatsApp one-to-one)** | Owned/earned | Fastest way to the first 10–15 users, and the most honest feedback | Personal messages, voice notes | Low | $0 |
| **Campus ambassadors ([3–5] people)** | Earned | Peer trust, and they reach students the founder doesn't know | Their own WhatsApp status, a word in club groups, demos to friends | Medium | $0 (non-cash perks, below) |
| **Beta WhatsApp group** | Owned | Feedback, bug reports and a sense of community. Free and already where people are | Group plus weekly prompt questions | Low–medium | $0 |
| **TikTok (organic)** | Owned | Where the main audience discovers apps. Short chat clips show memory well | 15–30s screen recordings, "POV" text-overlay clips | Medium–high | $0 |
| **Instagram Reels / status** | Owned | Cross-post the TikToks | Same clips | Low | $0 |
| **X (Kenyan tech Twitter)** | Earned | Build in public, reach the working-adult segment and possible pitch contacts | Short founder threads | Low | $0 |
| **Meetups and Latitude59 (3–4 Dec)** | Earned | In-person invites and investor networking (ticket cost is separate and not budgeted here) | Show it on your phone, hand out a QR code to a *request-an-invite* form | Medium | $0 here |
| **Email** | Owned | Onboarding and weekly beta check-ins once hello@ works | 3–4 emails (use `/marketing:email-sequence`) | Low | $0 |

**Ambassador perks (no cash):** first access to new characters and features, a "Founding Friend" credit on the
site (if they want it), a LinkedIn recommendation or reference letter, and first call on paid roles later. Every
ambassador must be 18+, must disclose the relationship when they post (use TikTok's branded-content toggle if
they post there), and must only post in groups that allow it.

**Skip for now:** paid ads (no budget), press (better after beta numbers), Reddit and Facebook groups (low fit,
and a risk of breaking group rules).

## 5. Content calendar (suggested dates)

| Week | Content piece | Channel | Owner/notes | Status |
|---|---|---|---|---|
| **W0** 9–15 Nov | Finish blockers 1–6. Set up TikTok/IG handle `@sasamigo` [if free]. Write the feedback form and invite message. Record [6–8] clips ahead of launch | — | Founder. **The domain must be live before any clip goes out** | ☐ |
| **W1** 16–22 Nov | **Wave 1: friends and family**, [10–15] one-to-one invites. Start the beta WhatsApp group. Post the first 2 TikToks ("Juno remembers", "Miles at 11pm, just vibes") | WhatsApp, TikTok | Founder. Clips depend on W0 recordings | ☐ |
| **W2** 23–29 Nov | **Wave 2: ambassadors.** Brief [3–5] ambassadors with the ambassador kit. Post 3 TikToks. Send onboarding email 1 to everyone so far | WhatsApp, TikTok, email | Ambassadors need the kit first. Email needs hello@ working | ☐ |
| **W3** 30 Nov–6 Dec | Show it at **Latitude59** (3–4 Dec) with a QR code to the invite form. Post 3 TikToks, including one "you're always told it's AI" clip. Post a founder thread on X | In person, TikTok, X | Founder. Check the event ticket separately | ☐ |
| **W4** 7–13 Dec | Retention push: weekly group prompt ("what did your character remember?"). First round of 1:1 feedback calls ([5–8] people). Post 2 TikToks | WhatsApp, TikTok | Founder. **Pause invites if you reach [cap]** | ☐ |
| **W5** 14–20 Dec | Mid-beta survey. Fix the top [3] issues. Ask for consent to share quotes. Post 2 TikToks | Form, WhatsApp | Founder. **Primary objective deadline: 19 Dec** | ☐ |
| **W6–7** 21 Dec–4 Jan | Holiday slowdown. Low-pressure posting, 1–2 clips. No pushy check-ins (the healthy-use promise) | TikTok | Many students are away and routines change | ☐ |
| **W8–9** 5–18 Jan | Final survey. Pull beta numbers from Supabase. Write a one-page beta readout and update the pitch deck's traction slide | Internal | Feeds into Google for Startups (1 Feb) | ☐ |

Leave about 20% of TikTok slots open for reacting to trends or anything funny beta users share (with
permission).

## 6. Content pieces needed

| Asset | Description | Priority | Make by |
|---|---|---|---|
| Personal invite message (WhatsApp) | 3–4 lines from the founder covering what it is, that it's 18+, that it's always AI, and what you're asking ("2 weeks + honest feedback") | Must | W0 |
| Beta welcome / group rules | How to give feedback, privacy reminder, how to delete your account, crisis note with Kenyan helplines | Must | W0 |
| Feedback form (Google Forms, free) | Short form: what you liked, what was weird, would you recommend it, [NPS-style 0–10], quote consent checkbox | Must | W0 |
| Request-an-invite form | Name, phone or email, 18+ checkbox, how they heard about it. Linked from the QR code and TikTok bio | Must | W0 |
| TikTok clip set ([10–14] clips) | Real screen recordings of the founder's own chats. AI badge always visible. Juno, Miles and Cole only. "18+" in captions | Must | W0 (6–8), then 2–3 a week |
| Ambassador kit | One page: pitch in 2 lines, do/don't list (no therapy claims, disclose, 18+ only), invite message, the clips | Must | W1 |
| Onboarding emails (3–4) | Welcome, "try a check-in", "your memories are yours", feedback ask | Should | W1 (use `/marketing:email-sequence`) |
| QR card / phone wallpaper for events | Uses brand assets in `public/brand/`. Print a few only if cheap; showing it on a phone is free | Nice | W2 |
| Founder X thread | "I built an AI friend app for Nairobi that's always honest it's AI. Here's why" | Nice | W3 |
| Beta readout (1 page) | Users, activity, retention, top feedback, consented quotes | Must | W9 |

## 7. Success metrics

Source: Supabase (users, age confirmations, messages, conversations) plus the forms. There's no analytics tool
in the stack yet, so write a few saved SQL queries in W0 and run them every Friday.

| KPI | Target | How it's tracked |
|---|---|---|
| **Primary: active beta users** (signed up + 18+ confirmed + [≥N] messages) | **20–50** by [19 Dec] | Supabase query |
| Invite → sign-up conversion | [x]% | Invites sent (spreadsheet) ÷ sign-ups |
| Week-2 return rate | [x]% | Users with messages in both week 1 and week 2 after sign-up |
| Memory / check-in engagement | [x]% of users reply to at least one check-in | Supabase |
| Feedback responses | [N] | Forms + call notes |
| Recommend score (0–10) | [baseline only, no target] | Feedback form |
| TikTok | [views], [invite requests from TikTok] | TikTok analytics + "how did you hear" field |
| Safety | 0 unresolved crisis-flow failures, and every deletion request handled within [N] days | Manual log |

**Reporting cadence:** a short note to yourself every Friday (5 numbers + top 3 pieces of feedback), a mid-beta
review at W5 and the final readout at W9. When you have real numbers, use `/marketing:performance-report`.

## 8. Budget allocation

| Item | Cost | Category |
|---|---|---|
| Domain `sasamigo.com` | ~$11 | Infrastructure (from the handoff) |
| Gemini paid tier, capped | ~$3–5 | Infrastructure / privacy promise |
| Contingency (rest of the $20) | ~$4–6 | e.g. a few printed QR cards, or extra AI usage if the beta is busy |
| Ads, influencers, ambassador pay | **$0** | Not used in this phase |
| Tools (Google Forms, WhatsApp, TikTok, Cloudflare Email Routing, CapCut or the phone's built-in editor) | $0 | Free tiers |
| Business-name registration (~KES 950) | Later | Outside this campaign |

Not included: Latitude59 ticket [cost TBC]. Work out AI usage cost per active user from the first week's
numbers: [$/user/week].

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **People think it's another "AI girlfriend" app** | Friendship-first characters lead every clip. Elena stays out of public content. Keep repeating the "always honestly AI" line. Run `/marketing:brand-review` on all copy before it goes out |
| **An under-18 signs up or is reached** | Sign-up asks for date of birth. Don't recruit in first-year or orientation spaces. "18+" in every caption and the invite. Ambassadors must be 18+ |
| **A beta user in crisis** | Test the crisis flow before W1. Founder checks the group daily. Helplines go in the welcome message. Never present the app as support or therapy |
| **The link leaks and sign-ups overshoot** | Watch the Supabase count. Pause invites at [cap]. Option (b) invite code if needed. AI spending cap prevents a surprise bill |
| **Too few sign-ups from campus** (exams or holidays) | Most of the target comes from the founder's own network in W1. Move campus pushes to [dates outside exams]. Accept the holiday dip in W6–7 |
| **Free AI tier or cost limits hit** | The Gemini cap is set. NVIDIA NIM ("Nova") is primary and Gemini ("Terra") is the fallback. Track cost per user from week 1 |
| **Ambassador posts break group rules or don't disclose** | Do/don't list in the kit. Founder reviews their first post. End the arrangement if it keeps happening |

## 10. Next steps

**This week (founder):**
1. Finish blockers 1–4 (Gemini tier, schema, domain, hello@).
2. Choose closed-beta option (a) or (b).
3. Make a list of [15] people to invite first and [5] possible ambassadors (all 18+).
4. Record 6–8 real chat clips with Juno, Miles and Cole.
5. Set the date for the first invites: [16 Nov].

**Decisions only the founder can make:** invite cap, whether to add an invite code, the ambassador list, whether
to attend Latitude59, and quote-consent wording.

**Next marketing tasks (from the handoff):** `/marketing:draft-content` for the clip scripts and the ambassador
kit, `/marketing:email-sequence` for the onboarding emails, and `/marketing:brand-review` on everything before
it goes out.

Claude does not post, sign up or apply on your behalf. Every invite, post and form above is yours to send.
