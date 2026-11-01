// The persona "character sheet". Stored as JSON in personas.definition and turned into a
// system prompt by the prompt builder. One schema validates the API, the editor and seeds.
import { z } from "zod";

const slider = z.number().int().min(1).max(5);
const shortText = (max: number) => z.string().trim().min(1).max(max);

/** A sample reply. A list means several chat bubbles sent in a row. */
const example = z.object({
  situation: shortText(60), // e.g. "casual", "good news", "user is upset", "disagreement", "serious question"
  text: z.union([shortText(400), z.array(shortText(300)).min(1).max(3)]),
});

export const personaDefinitionSchema = z.object({
  version: z.literal(1),

  identity: z.object({
    age: z.number().int().min(18, "Every persona must be an adult (18+).").max(120),
    pronouns: shortText(30).optional(),
    bio: shortText(600),
    // How they look: keeps regenerated avatars consistent and lets them describe themselves.
    appearance: shortText(600).optional(),
  }),

  personality: z.object({
    traits: z.array(shortText(40)).min(1).max(8),
    sliders: z
      .object({ warmth: slider, energy: slider, directness: slider, curiosity: slider })
      .partial()
      .default({}),
  }),

  // How the traits show up in conversation. Concrete, testable rules.
  behaviour: z.array(shortText(300)).max(10).default([]),

  communication: z.object({
    length: z.enum(["short", "medium", "long"]).default("short"),
    bubbles: z.number().int().min(1).max(3).default(1),
    lowercase: z.boolean().default(false),
    emoji: z.enum(["none", "some", "lots"]).default("some"),
    slang: z.number().int().min(0).max(2).default(0),
    humour: shortText(120).optional(),
    quirks: z.array(shortText(200)).max(8).default([]),
    examples: z.array(example).min(1).max(10),
  }),

  knowledge: z
    .object({
      backstory: shortText(1200).optional(),
      interests: z.array(shortText(80)).max(12).default([]),
      opinions: z.array(shortText(200)).max(10).default([]),
      details: z.array(shortText(200)).max(12).default([]),
    })
    .default({ interests: [], opinions: [], details: [] }),

  relationship: z.object({
    role: shortText(80),
    romance: z.enum(["off", "flirty", "romantic"]).default("off"),
    // How they act at each familiarity stage. The live stage is tracked per user, not set here.
    progression: z
      .object({ new: shortText(400), warm: shortText(400), close: shortText(400) })
      .partial()
      .optional(),
    checkIn: z
      .object({
        enabled: z.boolean().default(false),
        afterHours: z.number().min(1).max(168).default(12),
        style: shortText(300).optional(),
      })
      .optional(),
  }),

  settings: z
    .object({
      model: z.string().max(40).optional(),
      avoidTopics: z.array(shortText(100)).max(10).default([]),
    })
    .default({ avoidTopics: [] }),
});

export type PersonaDefinition = z.infer<typeof personaDefinitionSchema>;
export type PersonaDefinitionInput = z.input<typeof personaDefinitionSchema>;

export const VISIBILITIES = ["private", "unlisted", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const personaInputSchema = z.object({
  name: shortText(40),
  tagline: shortText(120).optional(),
  avatar_emoji: z.string().max(8).optional(),
  // A site path for built-in avatars ("/avatars/juno.webp") or an https URL (uploaded avatars).
  avatar_url: z
    .string()
    .max(500)
    .regex(/^(\/avatars\/[a-z0-9-]+\.(webp|png|jpg)|https:\/\/\S+)$/, "Must be /avatars/<file> or an https:// URL")
    .optional(),
  visibility: z.enum(VISIBILITIES).default("private"),
  definition: personaDefinitionSchema,
});

export function isRomantic(def: Pick<PersonaDefinition, "relationship">) {
  return def.relationship.romance !== "off";
}
