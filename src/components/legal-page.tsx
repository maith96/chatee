import Link from "next/link";
import { Logo, Wordmark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { SITE } from "@/lib/site";

/** Shared frame for the privacy policy and terms: readable column, headings, footer. */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-5">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Sasamigo home">
            <Logo size={32} />
            <Wordmark className="text-xl" />
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 pb-16">
        <article className="legal mx-auto max-w-3xl">
          <h1>{title}</h1>
          <p className="text-sm text-muted">Last updated: {SITE.legalUpdated}</p>
          {children}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
