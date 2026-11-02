// Style experiments (A/B tests). Each NEW persona chat is placed in one variant of the first active
// experiment that applies to its persona, and keeps it for its whole life. Results: /admin/stats.
//
// Guardrails: a variant may only change reply STYLE (length, bubbles, emoji, lowercase, a short style
// note) or the model. Never romance, check-ins, memory or the platform/safety rules.
// Before activating a variant, run `npm run eval -- --variant <experiment>:<variant>` to check it.
//
// This file is shared with the browser (no server-only imports).
import type { ModelId } from "./models";
import type { PersonaDefinition } from "./persona-schema";

type Communication = PersonaDefinition["communication"];

export type StyleOverrides = Partial<Pick<Communication, "length" | "bubbles" | "emoji" | "lowercase">> & {
  /** One extra style instruction, e.g. "Ask fewer questions; share more about your own day." */
  note?: string;
};

export type Variant = {
  id: string;
  /** Relative share of new chats (default 1). */
  weight?: number;
  style?: StyleOverrides;
  /** Use this model for the chat (unless the user picks one). */
  model?: ModelId;
};

export type Experiment = {
  id: string;
  description: string;
  /** Only active experiments assign new chats. Ended ones keep their results (and their chats revert to normal). */
  active: boolean;
  /** Which personas take part. */
  appliesTo: (persona: { slug: string | null; definition: PersonaDefinition }) => boolean;
  /** The first variant is the control (the persona as written). */
  variants: Variant[];
};

export const EXPERIMENTS: Experiment[] = [
  {
    id: "bubbles-v1",
    description: "Multi-bubble personas: their usual 2–3 bubbles per reply vs always a single bubble.",
    active: true,
    appliesTo: (p) => p.definition.communication.bubbles > 1,
    variants: [{ id: "control" }, { id: "one-bubble", style: { bubbles: 1 } }],
  },
];

export function getExperiment(id: string | null | undefined) {
  return EXPERIMENTS.find((e) => e.id === id) ?? null;
}

/** The variant a chat is in, if its experiment is still active (ended experiments stop changing anything). */
export function activeVariant(experimentId: string | null | undefined, variantId: string | null | undefined) {
  const experiment = getExperiment(experimentId);
  if (!experiment?.active) return null;
  return experiment.variants.find((v) => v.id === variantId) ?? null;
}

/** The persona's definition with the variant's style changes applied. */
export function applyVariant(def: PersonaDefinition, variant: Variant | null): PersonaDefinition {
  const style = variant?.style;
  if (!style) return def;
  const { note: _note, ...overrides } = style; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { ...def, communication: { ...def.communication, ...overrides } };
}

/** Readable summary of what a variant changes (for the stats page). */
export function describeVariant(v: Variant) {
  if (!v.style && !v.model) return "Persona as written";
  const parts: string[] = [];
  const s = v.style ?? {};
  if (s.bubbles !== undefined) parts.push(s.bubbles === 1 ? "single bubble" : `up to ${s.bubbles} bubbles`);
  if (s.length) parts.push(`${s.length} replies`);
  if (s.emoji) parts.push(`emoji: ${s.emoji}`);
  if (s.lowercase !== undefined) parts.push(s.lowercase ? "lowercase" : "normal capitals");
  if (s.note) parts.push(`“${s.note}”`);
  if (v.model) parts.push(`model: ${v.model}`);
  return parts.join(", ");
}
