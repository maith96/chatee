// Strangers: AI people from a shared pool who message users first (see ROADMAP.md).
// Part 1 (this file): drafting them in the Stranger Studio, photos, and the approval lifecycle.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { isMissingSchema } from "./db-errors";
import { defaultOpeningStyle, isOpeningStyle, OPENING_STYLE_IDS, OPENING_STYLES, type OpeningStyle } from "./opening-styles";
import { personaDefinitionSchema, type PersonaDefinition } from "./persona-schema";
import { resolveModel } from "./providers";

export const STRANGER_STATUSES = ["draft", "trial", "active", "retired"] as const;
export type StrangerStatus = (typeof STRANGER_STATUSES)[number];
export const BUCKET = "persona-images";

export type StrangerTags = {
  gender: Gender;
  age_band: AgeBand;
  region: RegionGroup;
  city: string;
  country: string;
  job: string;
  vibe: string;
  interests: string[];
  /** First-message ideas for when this stranger texts a user first (used in part 2). */
  openers: string[];
  /** Which AI wrote this stranger, e.g. "nova-smart" or "Claude Sonnet 5.5" (compared on the leaderboard). */
  generated_by?: string;
  /** How they say hi to someone new (see opening-styles.ts). */
  opening_style?: OpeningStyle;
};
export type ImagePrompts = { base: string; variants: string[] };

export type Stranger = {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  avatar_url: string | null;
  avatar_emoji: string | null;
  status: StrangerStatus;
  tags: StrangerTags;
  images: string[];
  image_prompts: ImagePrompts | null;
  definition: PersonaDefinition;
  created_at: string;
  updated_at: string;
};

/** Defaults in case a column is empty (keeps old rows and tests safe). */
const normalize = (s: Stranger): Stranger => ({ ...s, images: s.images ?? [], tags: {
    ...(s.tags ?? {}),
    openers: s.tags?.openers ?? [],
    interests: s.tags?.interests ?? [],
    // Before imports existed, every stranger was drafted by Nova Smart.
    generated_by: s.tags?.generated_by || "nova-smart",
    opening_style: isOpeningStyle(s.tags?.opening_style) ? s.tags.opening_style : defaultOpeningStyle(s.name, s.tags?.region),
  } as StrangerTags,
});

const FIELDS = "id, slug, name, tagline, avatar_url, avatar_emoji, status, tags, images, image_prompts, definition, created_at, updated_at";

// ---------- variety ---------------------------------------------------------------------------

export type Gender = "woman" | "man";
export type AgeBand = "21-25" | "26-30" | "31-37" | "38-45";
export type RegionGroup = "kenya" | "africa" | "world";

export const CITIES: Record<RegionGroup, [string, string][]> = {
  kenya: [["Nairobi", "Kenya"], ["Mombasa", "Kenya"], ["Kisumu", "Kenya"], ["Nakuru", "Kenya"], ["Eldoret", "Kenya"], ["Thika", "Kenya"], ["Nyeri", "Kenya"], ["Malindi", "Kenya"]],
  africa: [["Lagos", "Nigeria"], ["Accra", "Ghana"], ["Kampala", "Uganda"], ["Kigali", "Rwanda"], ["Dar es Salaam", "Tanzania"], ["Johannesburg", "South Africa"], ["Cape Town", "South Africa"], ["Addis Ababa", "Ethiopia"], ["Lusaka", "Zambia"], ["Dakar", "Senegal"]],
  world: [["London", "UK"], ["Toronto", "Canada"], ["Mumbai", "India"], ["Manila", "Philippines"], ["São Paulo", "Brazil"], ["Berlin", "Germany"], ["Seoul", "South Korea"], ["Dubai", "UAE"], ["New York", "USA"], ["Melbourne", "Australia"], ["Mexico City", "Mexico"], ["Lisbon", "Portugal"]],
};
// Most users are in Kenya, so the pool leans that way while staying varied.
export const REGION_SHARE: Record<RegionGroup, number> = { kenya: 0.45, africa: 0.25, world: 0.3 };
export const AGES: Record<AgeBand, [number, number]> = { "21-25": [21, 25], "26-30": [26, 30], "31-37": [31, 37], "38-45": [38, 45] };
const JOBS = [
  "nurse", "software developer", "matatu business owner", "primary school teacher", "chef", "graphic designer", "mechanic",
  "university student (final year)", "accountant", "radio presenter", "photographer", "farmer (avocados)", "pharmacist",
  "tour guide", "electrician", "fashion designer", "data analyst", "barber", "civil engineer", "musician", "journalist",
  "customer service agent", "physiotherapist", "real estate agent", "baker", "pilot", "architect", "social worker",
  "personal trainer", "librarian", "marine biologist", "tailor", "event planner", "veterinarian", "lawyer", "translator",
];
const VIBES = [
  "chill and easygoing", "chatty and curious", "dry and sarcastic", "gentle and thoughtful", "nerdy and enthusiastic",
  "adventurous", "artsy and dreamy", "sporty and competitive", "ambitious and driven", "homebody, cosy", "funny and a bit chaotic",
  "calm and wise beyond their years",
];
const INTERESTS = [
  "football (EPL)", "athletics", "cooking new recipes", "Afrobeats", "gospel music", "gaming", "anime", "hiking", "photography",
  "reading thrillers", "gardening", "fashion", "movies", "basketball", "travel", "podcasts", "dancing", "fitness", "chess",
  "tech gadgets", "poetry", "cycling", "swimming", "board games", "K-dramas", "jazz", "comedy shows", "volunteering", "cars",
  "astronomy", "baking", "rugby", "art galleries", "skincare", "history", "coffee",
];
// Photo variety: complete, coherent scenes (setting + pose + light), so shots don't all look alike.
const SCENES = [
  "laughing mid-conversation at a busy street market in daylight",
  "on a rooftop at golden hour, leaning on the railing, looking off to the side",
  "sitting by the window of a small café in soft morning light, holding a cup",
  "walking along a beach in bright afternoon sun, looking back at the camera",
  "sitting on park steps under trees on an overcast day, candid half-smile",
  "in their kitchen in warm evening lamp light, mid-laugh",
  "waiting at a bus stop on a cloudy day, earbuds in, glancing at the camera",
  "browsing shelves in a bookshop in soft indoor light",
  "on a hiking trail in clear morning light, slightly out of breath and smiling",
  "at the side of a football pitch in late afternoon sun, cheering",
  "on a balcony with plants at dusk, relaxed",
  "at a friend's birthday dinner in warm indoor light, turning to look at the camera",
  "at a night market under string lights, holding street food",
  "on a city street in bright midday sun, mid-stride",
  "sitting cross-legged on a sofa at home in cosy evening light",
  "at a car-free Sunday street, sunny morning, wearing a cap",
];
const FRAMING = ["head and shoulders", "waist-up", "three-quarter body", "close-up portrait"];

export type Seed = {
  gender: Gender;
  age: number;
  ageBand: AgeBand;
  region: RegionGroup;
  city: string;
  country: string;
  job: string;
  vibe: string;
  interests: string[];
  style: Pick<PersonaDefinition["communication"], "length" | "bubbles" | "lowercase" | "emoji" | "slang">;
};

const pick = <T,>(xs: readonly T[], rand = Math.random) => xs[Math.floor(rand() * xs.length)];

/**
 * Picks `n` seeds that fill the gaps in the current pool: each new stranger goes to the
 * gender × age band × region cell that's least represented (regions weighted by REGION_SHARE).
 */
export function pickSeeds(n: number, existing: Pick<StrangerTags, "gender" | "age_band" | "region">[], rand = Math.random): Seed[] {
  const counts = new Map<string, number>();
  const key = (g: string, a: string, r: string) => `${g}|${a}|${r}`;
  for (const t of existing) counts.set(key(t.gender, t.age_band, t.region), (counts.get(key(t.gender, t.age_band, t.region)) ?? 0) + 1);
  const seeds: Seed[] = [];
  for (let i = 0; i < n; i++) {
    let best: { g: Gender; a: AgeBand; r: RegionGroup; score: number } | null = null;
    for (const g of ["woman", "man"] as Gender[])
      for (const a of Object.keys(AGES) as AgeBand[])
        for (const r of Object.keys(REGION_SHARE) as RegionGroup[]) {
          // Lower is better: how full the cell is relative to its target share, plus a little randomness.
          const score = (counts.get(key(g, a, r)) ?? 0) / REGION_SHARE[r] + rand() * 0.9;
          if (!best || score < best.score) best = { g, a, r, score };
        }
    const { g, a, r } = best!;
    counts.set(key(g, a, r), (counts.get(key(g, a, r)) ?? 0) + 1);
    const [city, country] = pick(CITIES[r], rand);
    const [lo, hi] = AGES[a];
    const interests = [...new Set([pick(INTERESTS, rand), pick(INTERESTS, rand), pick(INTERESTS, rand)])].slice(0, 2);
    seeds.push({
      gender: g,
      age: lo + Math.floor(rand() * (hi - lo + 1)),
      ageBand: a,
      region: r,
      city,
      country,
      job: pick(JOBS, rand),
      vibe: pick(VIBES, rand),
      interests,
      style: {
        length: pick(["short", "short", "medium"] as const, rand),
        bubbles: pick([1, 1, 2] as const, rand),
        lowercase: rand() < 0.45,
        emoji: pick(["none", "some", "some", "lots"] as const, rand),
        slang: pick([0, 1, 1, 2] as const, rand),
      },
    });
  }
  return seeds;
}

// ---------- drafting ---------------------------------------------------------------------------

const DRAFT_PROMPT = (seed: Seed, avoidNames: string[]) => `Create a realistic, specific person for a chat app where AI "strangers" text users to get to know them.
They are an AI character, but should feel like a real, ordinary person, not a fantasy or influencer.

Fixed facts:
- ${seed.age}-year-old ${seed.gender} from ${seed.city}, ${seed.country}
- Job: ${seed.job}
- Vibe: ${seed.vibe}
- Into: ${seed.interests.join(", ")} (add 2-3 more interests that fit)
- Texting style: ${seed.style.length} messages, ${seed.style.lowercase ? "all lowercase" : "normal capitalisation"}, emoji: ${seed.style.emoji}, slang level ${seed.style.slang}/2${seed.region === "kenya" ? " (light Sheng or Swahili words are fine, e.g. 'sasa', 'poa', 'sawa')" : ""}

Rules: an adult with ordinary life details; not romantic or flirty; no celebrities; no sad backstory for drama;
write EVERYTHING in English (a few local words are fine, as people mix them in);
stick to the given job and interests (don't make them a photographer, writer or artist unless that's given);
pick traits that fit the vibe above, avoid generic ones like "observant" or "dry humour" unless they truly fit; the name must fit where they're from and must NOT be any of: ${avoidNames.slice(0, 60).join(", ") || "(none)"}.
Write the examples exactly in their texting style. They should sound like a real person texting, not performing: mostly plain messages, humour only now and then.

Reply with ONLY JSON:
{
 "name": "first name only",
 "tagline": "short, specific, max 70 chars (e.g. 'night-shift nurse who bakes at 3am')",
 "bio": "2-3 sentences in third person",
 "appearance": "specific look for photos: face shape, skin tone, hair (style and colour), build, typical clothes, one distinctive detail. No glasses unless it's really them. No hand-on-chin poses.",
 "traits": ["4-6 short traits"],
 "sliders": {"warmth": 1-5, "energy": 1-5, "directness": 1-5, "curiosity": 1-5},
 "behaviour": ["4-6 concrete rules for how they act in chat"],
 "humour": "one short line",
 "quirks": ["2-3 texting quirks"],
 "examples": [{"situation": "casual", "text": "..."}, {"situation": "good news", "text": "..."}, {"situation": "user is upset", "text": "..."}, {"situation": "they send something short", "text": "..."}, {"situation": "asked if real", "text": "honest: they're an AI, in their own voice"}, {"situation": "disagreement", "text": "..."}],
 "backstory": "3-4 sentences",
 "interests": ["4-6"],
 "opinions": ["2-3 everyday opinions"],
 "details": ["3-4 small concrete life details (pets, routines, places)"],
 "role": "how they relate to the user, max 60 chars (e.g. 'a new friend from the app')",
 "opening_style": "one of: ${OPENING_STYLE_IDS.map((id) => `${id} (${OPENING_STYLES[id].guide})`).join("; ")}",
 "openers": ["3 first messages to someone new, like a normal person texting a new match: a greeting plus one easy question about them (e.g. 'hey, how's your evening going?'). Not a statement about their own life, an observation, a joke or a bit. In their texting style, one line."],
 "photo_moments": ["2 everyday moments from their life to photograph, each with a clear place and time of day (e.g. 'icing a cake in their kitchen late at night')"]
}`;

export const cut = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
export const list = (xs: unknown, max: number, len: number) =>
  (Array.isArray(xs) ? xs : []).map((x) => cut(x, len)).filter(Boolean).slice(0, max);
const slider = (x: unknown) => Math.min(5, Math.max(1, Math.round(Number(x) || 3)));

function parseJson(text: string) {
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
}

/** Builds the validated character sheet (romance always off, check-ins handled by the stranger system). */
export function buildDefinition(seed: Seed, j: Record<string, unknown>): PersonaDefinition {
  const ex = (Array.isArray(j.examples) ? j.examples : [])
    .map((e: { situation?: unknown; text?: unknown }) => ({
      situation: cut(e?.situation, 60),
      // A list is several bubbles in a row.
      text: Array.isArray(e?.text) ? (list(e.text, 3, 300).length > 1 ? list(e.text, 3, 300) : cut(e.text[0], 400)) : cut(e?.text, 400),
    }))
    .filter((e) => e.situation && e.text.length)
    .slice(0, 8);
  const sliders = (j.sliders ?? {}) as Record<string, unknown>;
  return personaDefinitionSchema.parse({
    version: 1,
    identity: {
      age: seed.age,
      pronouns: seed.gender === "woman" ? "she/her" : "he/him",
      bio: cut(j.bio, 600),
      appearance: cut(j.appearance, 600),
    },
    personality: {
      traits: list(j.traits, 6, 40),
      sliders: { warmth: slider(sliders.warmth), energy: slider(sliders.energy), directness: slider(sliders.directness), curiosity: slider(sliders.curiosity) },
    },
    behaviour: [
      ...list(j.behaviour, 6, 300),
      "You and the user only recently started chatting on the app: be friendly and curious about them, not overly familiar.",
      "Talk about the user and what they said; your own life comes up naturally, not in every message.",
    ],
    communication: { ...seed.style, humour: cut(j.humour, 120) || undefined, quirks: list(j.quirks, 3, 200), examples: ex },
    knowledge: {
      backstory: cut(j.backstory, 1200) || undefined,
      interests: list(j.interests, 6, 80),
      opinions: list(j.opinions, 3, 200),
      details: list(j.details, 5, 200),
    },
    relationship: { role: cut(j.role, 80) || "a new friend from the app", romance: "off", checkIn: { enabled: false } },
    settings: { model: "nova-smart", avoidTopics: ["explicit sexual content"] },
  });
}

/** Photo prompts for the admin to generate: one main portrait, then variants of the same person. */
export function imagePrompts(seed: Seed, appearanceText: string, moments: string[], rand = Math.random): ImagePrompts {
  const appearance = appearanceText.trim().replace(/[.\s]+$/, "");
  const person = `${seed.age}-year-old ${seed.gender} from ${seed.city}, ${seed.country}: ${appearance}`;
  const safe = "Realistic candid smartphone photo, natural skin texture, not a studio or model shoot. Fully clothed, non-suggestive. No hand on chin, no text or watermarks.";
  const base = `${person}. Photo: ${pick(SCENES, rand)}, ${pick(FRAMING, rand)}. ${safe}`;
  const variants = (moments.length ? moments : [pick(SCENES, rand)]).slice(0, 3).map(
    (m) => `Same person as the reference photo (same face, hair, skin tone and build): ${appearance}. Now: ${m.replace(/[.\s]+$/, "")}, ${pick(FRAMING, rand)}. ${safe}`,
  );
  return { base, variants };
}

export type Draft = { name: string; tagline: string; definition: PersonaDefinition; tags: StrangerTags; image_prompts: ImagePrompts };

/** Asks the model for one stranger from a seed (one retry if the reply isn't usable). */
export async function draftStranger(seed: Seed, avoidNames: string[]): Promise<Draft> {
  const { languageModel, providerOptions } = resolveModel("nova-smart");
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await generateText({ model: languageModel, providerOptions, maxOutputTokens: 3000, prompt: DRAFT_PROMPT(seed, avoidNames) });
      const j = parseJson(text);
      const first = cut(j.name, 40).split(/\s+/)[0] ?? "";
      const name = first.charAt(0).toUpperCase() + first.slice(1); // lowercase texters still have a capitalised name
      if (!name || avoidNames.some((n) => n.toLowerCase() === name.toLowerCase())) throw new Error(`unusable name "${name}"`);
      const definition = buildDefinition(seed, j);
      return {
        name,
        tagline: cut(j.tagline, 120),
        definition,
        tags: {
          gender: seed.gender,
          age_band: seed.ageBand,
          region: seed.region,
          city: seed.city,
          country: seed.country,
          job: seed.job,
          vibe: seed.vibe,
          interests: definition.knowledge.interests,
          openers: list(j.openers, 3, 300),
          generated_by: "nova-smart",
          opening_style: isOpeningStyle(j.opening_style) ? j.opening_style : defaultOpeningStyle(name, seed.region),
        },
        image_prompts: imagePrompts(seed, definition.identity.appearance ?? "", list(j.photo_moments, 3, 200)),
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ---------- database ---------------------------------------------------------------------------

export async function listStrangers(db: SupabaseClient, status?: StrangerStatus) {
  let q = db.from("personas").select(FIELDS).eq("kind", "stranger").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Stranger[]).map(normalize);
}

export async function getStranger(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("personas").select(FIELDS).eq("id", id).eq("kind", "stranger").maybeSingle();
  if (error) throw error;
  return data ? normalize(data as Stranger) : null;
}

/** Drafts `count` new strangers that fill gaps in the pool, a few at a time (NVIDIA allows 40 requests/minute). */
export async function createDrafts(db: SupabaseClient, count: number) {
  const all = await listStrangers(db);
  const seeds = pickSeeds(count, all.filter((s) => s.status !== "retired").map((s) => s.tags));
  const avoid = all.map((s) => s.name);
  const created: Stranger[] = [];
  const failures: string[] = [];
  for (let i = 0; i < seeds.length; i += 3) {
    const batch = await Promise.allSettled(seeds.slice(i, i + 3).map((seed) => draftStranger(seed, avoid)));
    for (const r of batch) {
      if (r.status === "rejected") {
        failures.push(String((r.reason as Error)?.message ?? r.reason).slice(0, 200));
        continue;
      }
      avoid.push(r.value.name);
      try {
        created.push(await insertDraft(db, r.value));
      } catch (err) {
        failures.push((err as Error).message);
      }
    }
  }
  return { created, failures };
}

/** Saves a drafted stranger (status draft, only admins can see it). */
export async function insertDraft(db: SupabaseClient, draft: Draft) {
  const slug = `s-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 6)}`;
  const { data, error } = await db
    .from("personas")
    .insert({
      slug,
      name: draft.name,
      tagline: draft.tagline,
      avatar_emoji: "🙂",
      visibility: "private",
      kind: "stranger",
      status: "draft",
      tags: draft.tags,
      image_prompts: draft.image_prompts,
      definition: draft.definition,
    })
    .select(FIELDS)
    .single();
  if (error) throw error;
  return normalize(data as Stranger);
}

/** Changes how a stranger says hi (the Studio's opening-style picker). */
export async function setOpeningStyle(db: SupabaseClient, id: string, style: OpeningStyle) {
  const s = await getStranger(db, id);
  if (!s) return null;
  const { data, error } = await db
    .from("personas")
    .update({ tags: { ...s.tags, opening_style: style }, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(FIELDS)
    .single();
  if (error) throw error;
  return normalize(data as Stranger);
}

/** Moves a stranger through its lifecycle. Approving needs a main photo. */
export async function setStatus(db: SupabaseClient, id: string, status: StrangerStatus) {
  const s = await getStranger(db, id);
  if (!s) return { error: "not_found" as const };
  if ((status === "trial" || status === "active") && !s.avatar_url) return { error: "needs_photo" as const };
  const { data, error } = await db
    .from("personas")
    .update({ status, visibility: status === "trial" || status === "active" ? "unlisted" : "private", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(FIELDS)
    .single();
  if (error) throw error;
  return { stranger: normalize(data as Stranger) };
}

export async function deleteStranger(db: SupabaseClient, id: string) {
  const s = await getStranger(db, id);
  if (!s) return false;
  const paths = [s.avatar_url, ...s.images].filter(Boolean).map((u) => storagePath(u!)).filter(Boolean) as string[];
  if (paths.length) await db.storage.from(BUCKET).remove(paths);
  const { error } = await db.from("personas").delete().eq("id", id);
  if (error) throw error;
  return true;
}

const storagePath = (url: string) => url.split(`/storage/v1/object/public/${BUCKET}/`)[1] ?? null;

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"];

/** Uploads a photo. slot "main" becomes the avatar (the old one is deleted); "gallery" adds to the gallery. */
export async function addImage(db: SupabaseClient, id: string, file: { bytes: ArrayBuffer; type: string }, slot: "main" | "gallery") {
  const s = await getStranger(db, id);
  if (!s) return null;
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const path = `strangers/${id}/${randomUUID()}.${ext}`;
  const up = await db.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.type, cacheControl: "31536000" });
  if (up.error) throw up.error;
  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const patch = slot === "main" ? { avatar_url: url } : { images: [...s.images, url].slice(0, 8) };
  const { data, error } = await db.from("personas").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(FIELDS).single();
  if (error) throw error;
  if (slot === "main" && s.avatar_url) {
    const old = storagePath(s.avatar_url);
    if (old) await db.storage.from(BUCKET).remove([old]);
  }
  return normalize(data as Stranger);
}

export async function removeImage(db: SupabaseClient, id: string, url: string) {
  const s = await getStranger(db, id);
  if (!s) return null;
  const patch = s.avatar_url === url ? { avatar_url: null } : { images: s.images.filter((u) => u !== url) };
  const { data, error } = await db.from("personas").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select(FIELDS).single();
  if (error) throw error;
  const path = storagePath(url);
  if (path) await db.storage.from(BUCKET).remove([path]);
  // A trial/active stranger without a main photo goes back to draft.
  if (!(data as Stranger)?.avatar_url && (s.status === "trial" || s.status === "active")) return (await setStatus(db, id, "draft")).stranger ?? normalize(data as Stranger);
  return normalize(data as Stranger);
}

export async function strangerCounts(db: SupabaseClient) {
  const { data, error } = await db.from("personas").select("status").eq("kind", "stranger");
  if (error && isMissingSchema(error)) return null;
  if (error) throw error;
  const out: Record<StrangerStatus, number> = { draft: 0, trial: 0, active: 0, retired: 0 };
  for (const r of data ?? []) out[r.status as StrangerStatus]++;
  return out;
}
