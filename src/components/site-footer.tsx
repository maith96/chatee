import Link from "next/link";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-8 text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <p>
          © {SITE.copyrightYear} {SITE.company}. All rights reserved.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="hover:text-text hover:underline">Privacy</Link>
          <Link href="/terms" className="hover:text-text hover:underline">Terms</Link>
          <a href={`mailto:${SITE.contactEmail}`} className="hover:text-text hover:underline">{SITE.contactEmail}</a>
        </nav>
      </div>
    </footer>
  );
}
