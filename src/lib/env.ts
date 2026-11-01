// Validates the Supabase settings so a misconfigured deploy shows a clear message
// instead of a bare "Internal Server Error". Never prints the values themselves.
export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const problems: string[] = [];

  if (!url) problems.push("NEXT_PUBLIC_SUPABASE_URL is not set.");
  else if (!/^https?:\/\/[^/\s]+/.test(url))
    problems.push("NEXT_PUBLIC_SUPABASE_URL must be a full URL like https://abcd1234.supabase.co");
  if (!key) problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set.");
  else if (key.startsWith("sb_secret_"))
    problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a SECRET key. Use the publishable (sb_publishable_...) or anon key.");

  if (problems.length) throw new ConfigError(problems);
  return { url: url!, key: key! };
}

export class ConfigError extends Error {
  constructor(public problems: string[]) {
    super(
      "Server configuration error:\n- " +
        problems.join("\n- ") +
        "\n\nFix it in Vercel -> Project -> Settings -> Environment Variables, then REDEPLOY " +
        "(NEXT_PUBLIC_ variables are baked in at build time).",
    );
  }
}
