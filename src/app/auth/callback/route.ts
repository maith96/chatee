import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase sends users back here with ?code=... after email confirmation or Google sign-in.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (message: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  // e.g. the user cancelled on Google's screen, or the provider isn't set up.
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) return fail(providerError);

  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("Sign-in didn't complete. Please try again.");
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
