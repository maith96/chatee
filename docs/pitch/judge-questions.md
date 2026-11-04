# Sasamigo: judge questions and answers

Prep sheet for pitches and demo days. Backup slides A–D at the end of the pitch deck cover the hardest
questions (safety, unit economics, moat, privacy).

**Golden rule:** if you don't know, say "Great question, I don't know yet, and here's how we'll find out."
Judges trust honest founders more than confident guessing.

## 30-second elevator pitch

> Sasa! I'm [your name], founder of Sasamigo.
> AI companions today forget you, don't know our world, and the big ones are being sued for hooking people.
> Sasamigo is AI friends who remember your life, text you first, and know what's happening in Kenya today,
> and they're always honestly AI.
> It's built and live: five friends, AI strangers who say hi, a memory you control, and real helplines if
> you're struggling.
> We're starting in Nairobi with cheap M-Pesa bundles, and we're looking for [your ask].
> Try it at sasamigo.com.

---

## Safety and ethics (expect most questions here)

### 1. "Isn't an AI friend bad for lonely people? Won't they get dependent?"
That risk shaped the whole design. We don't measure success by messages sent. We track thumbs-up and whether
people come back after a week. Check-ins are gentle and never guilt-trip, and strangers stop messaging after two
are ignored. It's company, not a replacement for people.

### 2. "What if someone says they want to hurt themselves?" *(Backup slide A)*
We automatically detect crisis messages. The app then always shows real helplines, Kenya Red Cross 1199 first,
whatever the AI replies. The character also gets an urgent instruction to respond with care. Personas can't
override these safety rules.

### 3. "How do you keep minors out?"
We check date of birth at sign-up and store only the yes or no, never the date. If someone says in chat they're
under 18, we detect it and handle it. Underage accounts are closed and deleted.

### 4. "Some of your characters are romantic. Isn't that risky?"
It's adults only, and romance is only with characters people choose; we lead with friendship. The AI strangers
who message you first are never flirty.

### 5. "Aren't AI strangers just fake people tricking users?"
No. Every stranger has an AI badge everywhere it appears, and our terms ban passing AI messages off as real
people. Honesty is our brand, especially after reports of humans secretly posing as companion bots.

## Privacy

### 6. "What about privacy? These are intimate chats." *(Backup slide D)*
Users can see and delete every memory, and delete their whole account in one tap. Our stats use totals only, need
at least 5 users, and never read chat text. We follow Kenya's Data Protection Act, and our policy is public at
sasamigo.com/privacy.

## Product and tech

### 7. "Why not just use ChatGPT or Meta AI on WhatsApp?"
They're assistants. You ask, they answer, they don't know you as a friend. Our characters have personalities,
remember your life, text you first, bring up today's Kenyan news and use a little Sheng.

### 8. "What's your moat?" *(Backup slide C)*
- Character quality, tested with automated conversation evals and a judge model.
- Memories and relationships that get better the longer you use it.
- Local context.
- A trust-first brand.
- Data on which strangers people enjoy talking to, which improves our matching.

Big US apps aren't building for Kenya.

### 9. "What if NVIDIA or Google raises prices or goes down?"
We already run on two providers. If one is busy, replies switch to the other automatically. Models are a config
change, so we can move to cheaper or open models.

### 10. "Can it scale?"
We're on free development tiers today. NVIDIA allows 40 requests a minute, which is fine for a beta. Before
launch we move to paid tiers. The app runs on Vercel and Supabase, which scale with usage.

### 11. "Do the characters speak Swahili?"
They write in English with light Swahili and Sheng today. Better Swahili and Sheng is on our 3-month roadmap.

## Business and market

### 12. "How do you make money? Will Kenyans pay?"
Freemium: free daily messages, then small daily or weekly M-Pesa bundles. Kenyans already pay for data in daily
and weekly bundles, so it's a familiar habit. Safety features are never paywalled.

### 13. "What does each user cost you?" *(Backup slide B)*
Have a real number ready. Work it out as: replies per user per day × 30 × cost per AI reply. It's tiny with the
fast models. Without a number, say: "We'll know from our beta. Our pricing is set so a weekly bundle covers a
heavy user's AI cost several times over."

### 14. "Why Kenya first?"
It's young, mobile-first and digitally active, and no competitor builds for it. We understand the culture, the
news, M-Pesa and the slang. East Africa comes next.
*If you have a sourced statistic (smartphone users, youth population), cite it here.*

### 15. "How will you get users?"
Short video clips of funny or sweet chats on TikTok, WhatsApp sharing, campus ambassadors, and a closed beta in
Nairobi.

## Team

### 16. "Are you solo? Can one person do this?"
Say whether you're solo. If you are: "I've built and shipped the full product myself, the app, AI pipeline,
safety and legal basics. I'm looking for [a co-founder or role]."

---

## Fill in before you pitch
- [ ] Your name and your ask
- [ ] Cost per user (question 13 and backup slide B)
- [ ] Beta numbers: users, 7-day return, thumbs-up rate
- [ ] A sourced statistic for "Why Kenya first?"
- [ ] Check that sasamigo.com is live, or use your Vercel link
