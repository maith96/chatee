// Multi-bubble replies. The model separates chat bubbles with a line containing only "|||".
// Shared by the server (saving one row per bubble) and the UI (rendering while streaming).
export const BUBBLE_SEPARATOR = "|||";
const SPLIT = /\n?[ \t]*\|\|\|[ \t]*\n?/;
const PARAGRAPH = /\n[ \t]*\n/;
export const MAX_BUBBLES = 4;

/**
 * Splits a reply into bubbles, dropping empty ones. For multi-bubble personas a blank line also
 * starts a new bubble (models often use paragraphs for that). Extra bubbles merge into the last.
 */
export function splitBubbles(
  text: string,
  { paragraphs = false, max = MAX_BUBBLES }: { paragraphs?: boolean; max?: number } = {},
): string[] {
  // Models sometimes garble the separator ("||", or pipes split across lines): treat any line of
  // only pipes as a separator.
  let parts = text.replace(/^[ \t]*\|+[ \t]*$/gm, BUBBLE_SEPARATOR).split(SPLIT);
  if (paragraphs) parts = parts.flatMap((p) => p.split(PARAGRAPH));
  parts = parts.map((b) => b.trim()).filter(Boolean);
  const limit = Math.max(1, Math.min(max, MAX_BUBBLES));
  if (parts.length > limit) parts = [...parts.slice(0, limit - 1), parts.slice(limit - 1).join("\n")];
  return parts;
}

/** Joins bubbles back into the format the model writes (used when replaying history). */
export function joinBubbles(bubbles: string[]): string {
  return bubbles.join(`\n${BUBBLE_SEPARATOR}\n`);
}

/** While streaming, hides a separator that is only partly typed ("|" or "||") at the end. */
export function stripPartialSeparator(text: string): string {
  return text.replace(/\n?[ \t]*\|{1,2}[ \t]*$/, "");
}
