import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { isAdmin } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";
import { StrangerStudio } from "./studio";

export const metadata = { title: "Stranger Studio" };

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-muted">Loading…</div>}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await connection();
  const db = await createClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect("/login");
  if (!(await isAdmin(db).catch(() => false))) notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/" className="text-accent hover:underline">← Back to chats</Link>
        <Link href="/admin/stats" className="text-accent hover:underline">Stats</Link>
      </div>
      <h1 className="mt-2 text-2xl font-semibold">Stranger Studio</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Draft strangers, make their photos with the prompts, upload them and approve. Approved strangers start in <b>trial</b> (shown to a
        few users first), then go <b>active</b>. Drafts are only visible to admins. Strangers are never romantic and always say they&apos;re AI when asked.
      </p>
      <StrangerStudio />
    </main>
  );
}
