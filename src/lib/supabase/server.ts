import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Supabase client for the web app: the user's session lives in cookies. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url(), key(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes them.
        }
      },
    },
  });
}

/** Supabase client for API callers (mobile/other apps) that send `Authorization: Bearer <access token>`. */
export function createClientWithToken(accessToken: string) {
  return createSupabaseClient(url(), key(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
