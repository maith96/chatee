// Turns experiment counts into rates, 95% ranges and a plain-English verdict.
import type { FeedbackReason } from "./feedback";

export type ExperimentRow = {
  variant: string;
  users: number;
  conversations: number;
  replies: number;
  enough_data: boolean;
  answered: number | null;
  answerable: number | null;
  median_reply_seconds: number | null;
  avg_words: number | null;
  avg_bubbles: number | null;
  thumbs_up: number | null;
  thumbs_down: number | null;
  top_down_reason: FeedbackReason | null;
  day1_returned: number | null;
  day1_eligible: number | null;
  day7_returned: number | null;
  day7_eligible: number | null;
  user_messages_per_chat: number | null;
};

export type Rate = { rate: number; low: number; high: number; n: number } | null;

/** Wilson score interval (95%): a sensible range for a proportion, even with small samples. */
export function rate(successes: number | null, trials: number | null): Rate {
  if (successes == null || !trials) return null;
  const z = 1.96;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = (p + (z * z) / (2 * trials)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denom;
  return { rate: p, low: Math.max(0, centre - margin), high: Math.min(1, centre + margin), n: trials };
}

/** Two-sided p-value for a difference between two proportions (two-proportion z-test). */
export function pValue(a: Rate, b: Rate) {
  if (!a || !b) return null;
  const x1 = a.rate * a.n;
  const x2 = b.rate * b.n;
  const pooled = (x1 + x2) / (a.n + b.n);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.n + 1 / b.n));
  if (!se) return a.rate === b.rate ? 1 : 0;
  const z = Math.abs(a.rate - b.rate) / se;
  return 2 * (1 - normalCdf(z));
}

function normalCdf(x: number) {
  // Abramowitz–Stegun approximation (plenty for a dashboard).
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - p;
}

export const METRICS = [
  { key: "thumbs", label: "thumbs up", main: true },
  { key: "day7", label: "day-7 return", main: true },
  { key: "day1", label: "day-1 return", main: false },
  { key: "answered", label: "replies answered", main: false },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];

export function rates(r: ExperimentRow): Record<MetricKey, Rate> {
  const ratings = r.thumbs_up != null && r.thumbs_down != null ? r.thumbs_up + r.thumbs_down : null;
  return {
    thumbs: rate(r.thumbs_up, ratings),
    day7: rate(r.day7_returned, r.day7_eligible),
    day1: rate(r.day1_returned, r.day1_eligible),
    answered: rate(r.answered, r.answerable),
  };
}

const MIN_SAMPLE = 20; // per variant, per metric, before we call a difference

/** Compares each variant with the control: which metrics clearly differ (p < 0.05 with enough data). */
export function verdict(control: ExperimentRow | undefined, other: ExperimentRow) {
  if (!control?.enough_data || !other.enough_data) return { status: "early" as const, findings: [] };
  const a = rates(control);
  const b = rates(other);
  const findings: { metric: string; better: boolean; main: boolean; diff: number }[] = [];
  let measurable = false;
  for (const m of METRICS) {
    const x = a[m.key];
    const y = b[m.key];
    if (!x || !y || x.n < MIN_SAMPLE || y.n < MIN_SAMPLE) continue;
    measurable = true;
    const p = pValue(x, y);
    if (p != null && p < 0.05) findings.push({ metric: m.label, better: y.rate > x.rate, main: m.main, diff: y.rate - x.rate });
  }
  if (!measurable) return { status: "early" as const, findings };
  return { status: findings.length ? ("clear" as const) : ("no-difference" as const), findings };
}
