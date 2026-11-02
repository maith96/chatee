import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AgeGate } from "@/components/age-gate";
import ChatApp from "@/components/chat-app";
import { isAdultConfirmed } from "@/lib/age";
import { isAdmin } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <Suspense fallback={<div className="h-dvh" />}>
      <SignedInChat />
    </Suspense>
  );
}

async function SignedInChat() {
  await connection(); // always render per request (auth-dependent)
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  if (!(await isAdultConfirmed(supabase, data.user))) return <AgeGate />;
  const admin = await isAdmin(supabase).catch(() => false); // false until schema v4 is run
  return <ChatApp email={data.user.email ?? ""} admin={admin} />;
}
