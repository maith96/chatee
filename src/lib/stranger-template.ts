// Drafting strangers with an outside model (Claude, ChatGPT, Grok…): the Studio gives the admin a prompt
// to paste into that model, then imports the JSON it replies with. Every import records which model wrote it.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGES,
  buildDefinition,
  cut,
  imagePrompts,
  insertDraft,
  list,
  listStrangers,
  pickSeeds,
  type AgeBand,
  type Draft,
  type Gender,
  type RegionGroup,
  type Seed,
  type Stranger,
} from "./strangers";

export const MAX_IMPORT = 10;

const AFRICA = new Set([
  "algeria", "angola", "benin", "botswana", "burkina faso", "burundi", "cabo verde", "cape verde", "cameroon",
  "central african republic", "chad", "comoros", "congo", "dr congo", "democratic republic of the congo", "drc",
  "côte d'ivoire", "cote d'ivoire", "ivory coast", "djibouti", "egypt", "equatorial guinea", "eritrea", "eswatini",
  "ethiopia", "gabon", "gambia", "the gambia", "ghana", "guinea", "guinea-bissau", "lesotho", "liberia", "libya",
  "madagascar", "malawi", "mali", "mauritania", "mauritius", "morocco", "mozambique", "namibia", "niger", "nigeria",
  "rwanda", "são tomé and príncipe", "sao tome and principe", "senegal", "seychelles", "sierra leone", "somalia",
  "south africa", "south sudan", "sudan", "tanzania", "togo", "tunisia", "uganda", "zambia", "zimbabwe",
]);

export function regionOfCountry(country: string): RegionGroup {
  const c = country.trim().toLowerCase();
  if (c === "kenya") return "kenya";
  return AFRICA.has(c) ? "africa" : "world";
}

export function ageBand(age: number): AgeBand | null {
  for (const [band, [lo, hi]] of Object.entries(AGES) as [AgeBand, [number, number]][]) if (age >= lo && age <= hi) return band;
  return null;
}

const styleLine = (s: Seed["style"]) =>
  [
    `${s.length} messages`,
    s.bubbles > 1 ? `often splits a reply into ${s.bubbles} bubbles` : "one bubble per reply",
    s.lowercase ? "all lowercase" : "normal capitalisation",
    `emoji: ${s.emoji}`,
    `slang ${s.slang}/2`,
  ].join(", ");

/**
 * The prompt for the outside model: `seeds` fix who's needed to fill gaps in the pool (gender, age, place,
 * texting mechanics); the model invents everything else. The existing pool is listed so it doesn't repeat it.
 */
export function buildTemplate(seeds: Seed[], pool: Pick<Stranger, "name" | "tagline" | "tags">[]) {
  const people = seeds
    .map((s, i) => `${i + 1}. ${s.gender}, ${s.age}, from ${s.city}, ${s.country}. Texting style: ${styleLine(s.style)}.`)
    .join("\n");
  const existing = pool.length
    ? pool
        .slice(0, 40)
        .map((p) => `- ${p.name} (${p.tags.job || "?"}, ${p.tags.city || "?"}): ${p.tagline ?? ""}${p.tags.openers?.[0] ? ` | opener: "${p.tags.openers[0]}"` : ""}`)
        .join("\n")
    : "(none yet)";

  return `You're helping me cast AI characters for a chat app. In the app, AI "strangers" message users first, like a new contact on WhatsApp, and get to know them over days and weeks. Users know these are AI characters (the app labels them, and the character admits it if asked), but they should feel like texting a real, specific, ordinary person.

Create ${seeds.length} different people. These facts are fixed for each one:

${people}

Everything else is yours to invent: name, job, life, personality, interests and how they talk. Most users are in Kenya, many elsewhere in Africa.

## What makes a good stranger

The last batch of these (written by another model) came out generic: stock personalities, the same kind of opening line, everyone "chill" or "curious" with a "dry sense of humour". Avoid that. A good stranger:
- Has one specific, slightly unusual detail that makes them memorable and easy to ask about, like a side hustle, an odd routine, a running feud, a project or a recent small disaster. Something that gives the user an easy thing to ask about.
- Has something going on right now (this week or this month) that can come up naturally in chat: a deadline, a trip, a visitor, a broken thing, a plan, a small win.
- Has real opinions, some of them a bit wrong or petty, and a contradiction or two (e.g. organised at work, chaos at home).
- Has an ordinary job and life that fits their city and age: not an influencer, entrepreneur-guru, artist-photographer or life coach unless it really fits. Money, family, commutes and weather are real parts of their life.
- Sounds like themselves. Their texting voice should be recognisable without their name on it, and different from the others in this batch: different rhythm, humour (or none), what they notice, how they ask things, how they react.
- Is not a "perfect friend". They have moods, get distracted, are sometimes busy, don't gush, and don't compliment the user all the time.

Each person must also be different from each other and from the strangers already in the app (don't reuse names, jobs, hooks or opening lines):

${existing}

## Hard rules
- Adults only (the ages above). Not romantic or flirty, ever. No explicit content. No celebrities or real public figures.
- No tragic backstory for drama (ordinary ups and downs are fine).
- Write everything in English. A few local words mixed in are fine and good (e.g. light Sheng or Swahili for Kenyans, Pidgin for a Lagosian), as long as an English speaker can follow.
- They text; they don't narrate actions. No *asterisks*, no stage directions.
- They never pretend they can meet up in person, call, or send real photos. They live their life and chat about it.
- If asked whether they're real: they say honestly that they're an AI, in their own voice, without breaking the vibe.

## Opening messages (important)
Each person needs 3 first messages they'd send to someone new who hasn't said anything yet. These matter most: they decide whether the user replies.
- Each of the 3 must work differently: e.g. one about something that just happened to them, one asking for the user's opinion on something specific and small, one reacting to something ordinary (weather, traffic, food, a match, a show).
- Specific to their life, low-pressure, easy to answer in a few words. At most one question.
- Don't start with "hey stranger", "random question", "so...", "okay but", "be honest", "quick question", "hi there" or their own name. No compliments on looks. Don't pretend to know the user.
- Across the whole batch, no two openers should share a structure or first word.

## Example messages
For each person, 8 short example texts in their exact texting style (length, capitalisation, emoji, slang as given above), for these situations: casual chat, the user shares good news, the user is upset, the user sends something very short ("lol" / "ok"), the user asks if they're real, a mild disagreement, they talk about their own day, they ask the user something. Sound like real texts, not lines from a script: mostly plain, humour only sometimes. Where the style splits replies into bubbles, an example can be a list of 2-3 bubbles.

## Output
Reply with ONLY a JSON array (no commentary), one object per person, in the order above:

[
  {
    "name": "first name only",
    "gender": "woman" | "man",
    "age": 0,
    "city": "",
    "country": "",
    "job": "their job, short",
    "vibe": "3-6 words that capture them",
    "tagline": "specific, max 70 chars (e.g. 'night-shift nurse who bakes at 3am')",
    "bio": "2-3 sentences, third person",
    "appearance": "specific look for photos: face, skin tone, hair (style and colour), build, typical clothes, one distinctive detail",
    "traits": ["4-6 specific traits, not generic ones"],
    "sliders": { "warmth": 1-5, "energy": 1-5, "directness": 1-5, "curiosity": 1-5 },
    "behaviour": ["4-6 concrete rules for how they act in chat, e.g. 'goes quiet and short when tired after a shift'"],
    "humour": "one short line on their humour (or 'rarely jokes')",
    "quirks": ["2-3 texting quirks"],
    "texting": { "length": "short" | "medium", "bubbles": 1-3, "lowercase": true | false, "emoji": "none" | "some" | "lots", "slang": 0-2 },
    "examples": [{ "situation": "casual", "text": "..." }],
    "backstory": "3-4 sentences",
    "right_now": "what's going on in their life this week or month",
    "interests": ["4-6"],
    "opinions": ["3 everyday opinions, some petty"],
    "details": ["4 small concrete life details: people, places, routines, things they own"],
    "role": "how they relate to the user, max 60 chars (e.g. 'a new friend from the app')",
    "openers": ["3 first messages, as described above"],
    "photo_moments": ["2 everyday moments from their life to photograph, each with a clear place and time of day"]
  }
]`;
}

/** The template for `count` strangers that fill the pool's gaps. */
export async function templateFor(db: SupabaseClient, count: number) {
  const all = await listStrangers(db);
  const seeds = pickSeeds(count, all.filter((s) => s.status !== "retired").map((s) => s.tags));
  return buildTemplate(seeds, all.filter((s) => s.status !== "retired"));
}

/** Pulls the JSON out of a model reply (tolerates ```json fences and text around it). */
export function parseReply(text: string): Record<string, unknown>[] {
  const clean = text.replace(/```(?:json)?/gi, "");
  const start = clean.search(/[[{]/);
  if (start < 0) throw new Error("No JSON found. Paste the model's whole reply.");
  const end = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));
  const parsed = JSON.parse(clean.slice(start, end + 1)) as unknown;
  const items = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { strangers?: unknown }).strangers) ? (parsed as { strangers: unknown[] }).strangers : [parsed];
  return items.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
}

const oneOf = <T extends string | number>(x: unknown, options: readonly T[], fallback: T) => (options.includes(x as T) ? (x as T) : fallback);

/** Turns one imported object into a draft, or explains why it can't. Pure, so it's easy to test. */
export function draftFromImport(j: Record<string, unknown>, generatedBy: string, takenNames: string[]): Draft {
  const first = cut(j.name, 40).split(/\s+/)[0] ?? "";
  const name = first.charAt(0).toUpperCase() + first.slice(1);
  if (!name) throw new Error("missing name");
  if (takenNames.some((n) => n.toLowerCase() === name.toLowerCase())) throw new Error(`${name}: that name is already in the pool`);
  const gender = String(j.gender ?? "").toLowerCase();
  if (gender !== "woman" && gender !== "man") throw new Error(`${name}: gender must be "woman" or "man"`);
  const age = Math.round(Number(j.age));
  const band = ageBand(age);
  if (!band) throw new Error(`${name}: age must be 21-45 (got ${j.age ?? "nothing"})`);
  const city = cut(j.city, 60);
  const country = cut(j.country, 60);
  if (!city || !country) throw new Error(`${name}: missing city or country`);
  const t = (j.texting ?? {}) as Record<string, unknown>;
  const seed: Seed = {
    gender: gender as Gender,
    age,
    ageBand: band,
    region: regionOfCountry(country),
    city,
    country,
    job: cut(j.job, 60) || "unknown",
    vibe: cut(j.vibe, 60),
    interests: list(j.interests, 6, 80),
    style: {
      length: oneOf(t.length, ["short", "medium", "long"] as const, "short"),
      bubbles: oneOf(Math.round(Number(t.bubbles)), [1, 2, 3] as const, 1),
      lowercase: t.lowercase === true,
      emoji: oneOf(t.emoji, ["none", "some", "lots"] as const, "some"),
      slang: oneOf(Math.round(Number(t.slang)), [0, 1, 2] as const, 0),
    },
  };
  // "right now" becomes the first life detail, so it's in front of the model in every chat.
  const rightNow = cut(j.right_now, 200);
  const details = [...(rightNow ? [`Right now: ${rightNow}`] : []), ...list(j.details, 4, 200)];
  let definition;
  try {
    definition = buildDefinition(seed, { ...j, details });
  } catch (err) {
    const issue = (err as { issues?: { path: (string | number)[]; message: string }[] }).issues?.[0];
    throw new Error(`${name}: ${issue ? `${issue.path.join(".")}: ${issue.message}` : (err as Error).message}`);
  }
  const openers = list(j.openers, 3, 300);
  if (!openers.length) throw new Error(`${name}: needs at least one opener`);
  return {
    name,
    tagline: cut(j.tagline, 120),
    definition,
    tags: {
      gender: seed.gender,
      age_band: band,
      region: seed.region,
      city,
      country,
      job: seed.job,
      vibe: seed.vibe,
      interests: definition.knowledge.interests,
      openers,
      generated_by: cut(generatedBy, 40) || "unknown",
    },
    image_prompts: imagePrompts(seed, definition.identity.appearance ?? "", list(j.photo_moments, 3, 200)),
  };
}

/** Imports a pasted model reply as drafts. Each person succeeds or fails on its own. */
export async function importStrangers(db: SupabaseClient, text: string, generatedBy: string) {
  const items = parseReply(text);
  if (!items.length) throw new Error("No strangers found in the JSON.");
  if (items.length > MAX_IMPORT) throw new Error(`At most ${MAX_IMPORT} strangers per import (got ${items.length}).`);
  const taken = (await listStrangers(db)).map((s) => s.name);
  const created: Stranger[] = [];
  const failures: string[] = [];
  for (const j of items) {
    try {
      const draft = draftFromImport(j, generatedBy, taken);
      created.push(await insertDraft(db, draft));
      taken.push(draft.name);
    } catch (err) {
      failures.push(String((err as Error).message ?? err).slice(0, 200));
    }
  }
  return { created, failures };
}
