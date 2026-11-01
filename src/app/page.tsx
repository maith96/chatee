import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import ChatApp from "@/components/chat-app";
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
  return <ChatApp email={data.user.email ?? ""} />;
}
