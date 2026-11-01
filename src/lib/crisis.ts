// Crisis detection and support resources. Shared by the server (adds an urgent instruction to the
// persona's prompt) and the UI/API (always shows helpline info, whatever the model says).
// Words that suggest the user might be in crisis. Deliberately broad: a false alarm costs a kind
// check-in; a miss could cost much more.
const CRISIS_PATTERNS = [
  /\b(kill|hurt|harm|cut)(ing)? myself\b/i,
  /\bkms\b/i,
  /\bsuicid/i,
  /\bself[- ]?harm/i,
  /\b(want|wanna|going) to die\b/i,
  /\bend (it all|my life|things)\b/i,
  /\b(don'?t|do not) (want to|wanna) (be here|live|exist)/i,
  /\b(no|don'?t see the|what'?s the) point (of|in) (anything|living|life|going on)/i,
  /\bwant to disappear\b/i,
  /\bbetter off without me\b/i,
  /\bcan'?t (go on|do this anymore|take it anymore)\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

export const CRISIS_RESOURCES = [
  { region: "US", text: "Call or text 988 (Suicide & Crisis Lifeline)", href: "tel:988" },
  { region: "UK & Ireland", text: "Call Samaritans on 116 123 (free, 24/7)", href: "tel:116123" },
  { region: "Anywhere", text: "Find a free, confidential helpline near you", href: "https://findahelpline.com" },
];
