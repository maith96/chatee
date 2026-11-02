// Server-side: which experiment and variant a new persona chat goes into.
import { createHash } from "node:crypto";
import { EXPERIMENTS, type Experiment, type Variant } from "./experiments";
import type { Persona } from "./personas";

/** Deterministic: the same chat id always lands in the same variant. */
export function pickVariant(experiment: Experiment, chatId: string): Variant {
  const hash = createHash("sha256").update(`${experiment.id}:${chatId}`).digest();
  const point = hash.readUInt32BE(0) / 2 ** 32;
  const total = experiment.variants.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  let acc = 0;
  for (const v of experiment.variants) {
    acc += (v.weight ?? 1) / total;
    if (point < acc) return v;
  }
  return experiment.variants.at(-1)!;
}

/** The first active experiment for this persona, and the chat's variant in it. */
export function assignExperiment(persona: Persona, chatId: string) {
  if (persona.kind === "stranger") return null; // strangers have their own fixed style
  const experiment = EXPERIMENTS.find((e) => e.active && e.variants.length > 1 && e.appliesTo(persona));
  if (!experiment) return null;
  return { experiment, variant: pickVariant(experiment, chatId) };
}
