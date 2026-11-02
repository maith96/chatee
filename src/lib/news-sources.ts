// News feeds, regions and topics. Shared with the browser (settings UI), so no server-only imports.

export const REGIONS = ["global", "africa", "asia", "europe", "uk", "north_america", "latin_america", "middle_east", "oceania"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  global: "World",
  africa: "Africa",
  asia: "Asia",
  europe: "Europe",
  uk: "UK",
  north_america: "US & Canada",
  latin_america: "Latin America",
  middle_east: "Middle East",
  oceania: "Australia & Pacific",
};

export const TOPICS = ["world", "politics", "business", "tech", "science", "health", "sport", "entertainment", "culture", "climate", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  world: "World affairs",
  politics: "Politics",
  business: "Business",
  tech: "Tech",
  science: "Science",
  health: "Health",
  sport: "Sport",
  entertainment: "Entertainment",
  culture: "Culture",
  climate: "Climate & nature",
  other: "Other",
};

/** Free RSS feeds. `region`/`topic` are defaults; the digest model can refine them per item. */
export const FEEDS: { url: string; source: string; region: Region; topic: Topic }[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC", region: "global", topic: "world" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian", region: "global", topic: "world" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera", region: "global", topic: "world" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR", region: "north_america", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", source: "BBC", region: "africa", topic: "world" },
  { url: "https://www.africanews.com/feed/rss", source: "Africanews", region: "africa", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", source: "BBC", region: "asia", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", source: "BBC", region: "europe", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/uk/rss.xml", source: "BBC", region: "uk", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml", source: "BBC", region: "north_america", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", source: "BBC", region: "latin_america", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", source: "BBC", region: "middle_east", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/world/australia/rss.xml", source: "BBC", region: "oceania", topic: "world" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC", region: "global", topic: "tech" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC", region: "global", topic: "science" },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", source: "BBC", region: "global", topic: "entertainment" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC", region: "global", topic: "business" },
  { url: "https://feeds.bbci.co.uk/news/health/rss.xml", source: "BBC", region: "global", topic: "health" },
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", source: "BBC Sport", region: "global", topic: "sport" },
];

const MIDDLE_EAST = /^Asia\/(Dubai|Riyadh|Qatar|Kuwait|Bahrain|Muscat|Baghdad|Tehran|Jerusalem|Tel_Aviv|Gaza|Hebron|Amman|Beirut|Damascus|Aden)$/;
const LATIN_AMERICA = /^America\/(Argentina\/.+|Sao_Paulo|Bahia|Fortaleza|Recife|Manaus|Belem|Mexico_City|Monterrey|Cancun|Bogota|Lima|Santiago|Caracas|La_Paz|Asuncion|Montevideo|Guayaquil|Guatemala|Havana|Panama|Costa_Rica|El_Salvador|Managua|Tegucigalpa|Santo_Domingo|Puerto_Rico)$/;

/** A first guess at the user's region from their device timezone. */
export function regionFromTimezone(tz: string | undefined | null): Region | null {
  if (!tz) return null;
  if (tz === "Europe/London" || tz === "Europe/Belfast") return "uk";
  if (MIDDLE_EAST.test(tz)) return "middle_east";
  if (LATIN_AMERICA.test(tz)) return "latin_america";
  if (tz.startsWith("Africa/")) return "africa";
  if (tz.startsWith("Europe/")) return "europe";
  if (tz.startsWith("America/") || tz.startsWith("US/") || tz.startsWith("Canada/")) return "north_america";
  if (tz.startsWith("Asia/")) return "asia";
  if (tz.startsWith("Australia/") || tz.startsWith("Pacific/")) return "oceania";
  return null;
}

export const isRegion = (x: unknown): x is Region => REGIONS.includes(x as Region);
export const isTopic = (x: unknown): x is Topic => TOPICS.includes(x as Topic);
