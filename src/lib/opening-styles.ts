// How a stranger says hi to someone new. Every style is a normal greeting plus an easy question;
// they differ in tone, not in being clever (no "bits", see ROADMAP.md). Safe to import in the browser.

export const OPENING_STYLES = {
  shy: {
    label: "Shy",
    guide: "a bit hesitant and soft, like starting conversations isn't easy for you: a quiet hi, maybe a small nervous aside in your own words, then an easy question",
  },
  dry: {
    label: "Dry",
    guide: "minimal and low-key: few words, no exclamation marks, no emoji (e.g. hi. how's the day going)",
  },
  warm: {
    label: "Warm",
    guide: "friendly and open, glad to be saying hi (e.g. hey! how's your day been?)",
  },
  upbeat: {
    label: "Upbeat",
    guide: "a bit of energy, light and cheerful, but still a plain hi and a question, not a joke",
  },
  local: {
    label: "Local greeting",
    guide: "opens with a greeting people really use where you live (e.g. sasa / niaje in Kenya, how far in Nigeria, howzit in South Africa), then an easy question",
  },
  context: {
    label: "What I'm up to",
    guide: "three to six plain words about what you're doing right now (just got off work / on my break / making supper), then an easy question. Something ordinary from your routine, not the thing going on in your life right now (save that for later in the chat). No story, no comment on it",
  },
} as const;

export type OpeningStyle = keyof typeof OPENING_STYLES;
export const OPENING_STYLE_IDS = Object.keys(OPENING_STYLES) as OpeningStyle[];

export const isOpeningStyle = (x: unknown): x is OpeningStyle => typeof x === "string" && x in OPENING_STYLES;

/** What the easy question is about. Picked at random for each first message, so one stranger doesn't always ask the same thing. */
export const QUESTION_SHAPES = [
  "how their day or evening is going",
  "what they're up to right now",
  "how their week is going so far",
  "what they've got on later or this weekend",
  "whether today's been a good one or a long one",
];

/** For strangers saved before opening styles existed: a stable pick from their name. */
export function defaultOpeningStyle(name: string, region?: string): OpeningStyle {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool: OpeningStyle[] = region === "kenya" || region === "africa" ? [...OPENING_STYLE_IDS, "local"] : OPENING_STYLE_IDS.filter((s) => s !== "local");
  return pool[h % pool.length];
}
