import { Suspense } from "react";
import { connection } from "next/server";
import { AgeGate } from "@/components/age-gate";
import ChatApp from "@/components/chat-app";
import { Landing } from "@/components/landing";
import { isAdultConfirmed } from "@/lib/age";
import { isAdmin } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export default function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <SignedInChat searchParams={searchParams} />
    </Suspense>
  );
}

/** Signed in: the chat app. Signed out: the landing page. */
async function SignedInChat({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // always render per request (auth-dependent)
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <Landing deleted={(await searchParams).deleted === "1"} />;
  if (!(await isAdultConfirmed(supabase, data.user))) return <AgeGate />;
  const admin = await isAdmin(supabase).catch(() => false); // false until schema v4 is run
  return <ChatApp email={data.user.email ?? ""} admin={admin} />;
}
