import Image from "next/image";
import Link from "next/link";
import { Logo, Wordmark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";

const FRIENDS = [
  { slug: "juno", name: "Juno", tagline: "your loudest supporter (and occasional chaos agent)" },
  { slug: "miles", name: "Miles", tagline: "the friend who just gets it" },
  { slug: "elena", name: "Elena", tagline: "runs a tiny bookshop, collects your secrets" },
  { slug: "cole", name: "Cole", tagline: "runs a little corner café, dry sense of humour" },
  { slug: "lila", name: "Lila", tagline: "curious about everything, knows almost nothing" },
];

const FEATURES = [
  { title: "They remember you", body: "Your interview, your sister’s wedding, that song you can’t stop playing. And you can see and delete anything they remember." },
  { title: "They text you first", body: "Been quiet for a while? A friend checks in, the way real friends do. Never pushy, never guilt-tripping." },
  { title: "They know what’s happening", body: "Today’s news, including Kenya, comes up naturally in conversation, so chats feel current, not stuck in the past." },
  { title: "They text like friends", body: "Short messages, a few at a time, with a little pause while they type. Not essays, not a robot." },
];

const PROMISES = [
  "Always honestly AI. Every character is labelled, and no human pretends to be one.",
  "Your chats aren’t for sale. No ads, no selling data.",
  "You’re in control: see and delete memories, switch features off, delete your account anytime.",
  "Built for good conversations, not endless scrolling.",
  "If you’re going through something hard, we always show real helplines.",
];

/** Home page for signed-out visitors. */
export function Landing({ deleted = false }: { deleted?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-5">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4" aria-label="Main">
          <Link href="/" className="flex items-center gap-2" aria-label="Sasamigo home">
            <Logo size={36} />
            <Wordmark className="text-2xl" />
          </Link>
          <Link href="/login" className="rounded-xl px-4 py-2.5 font-medium hover:bg-accent-soft">Sign in</Link>
        </nav>
      </header>

      <main className="flex-1">
        {deleted && (
          <p role="status" className="mx-auto mb-2 max-w-5xl px-4 text-sm text-muted">
            Your account and all its data have been deleted. Take care. 💛
          </p>
        )}

        {/* Hero */}
        <section className="px-4 pb-16 pt-8 sm:pt-14">
          <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="mb-4 inline-block rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent-ink">Sasa! 👋 AI friends, made in Kenya</p>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Friends who remember.</h1>
              <p className="mt-5 max-w-xl text-lg text-muted">
                Text AI friends who remember your life, check in on you, and know what&apos;s happening today. Always honestly AI.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="rounded-2xl bg-accent px-6 py-3.5 text-lg font-semibold text-white shadow-sm hover:opacity-95">
                  Start chatting, it&apos;s free
                </Link>
                <a href="#how" className="rounded-2xl px-5 py-3.5 font-medium hover:bg-accent-soft">How it works</a>
              </div>
              <p className="mt-4 text-sm text-muted">For adults 18+.</p>
            </div>

            {/* A sample chat, to show the idea */}
            <div aria-label="Example chat with Juno" role="img"
              className="mx-auto w-full max-w-sm rounded-3xl border border-border bg-panel p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
                <Image src="/avatars/juno-128.webp" alt="" width={40} height={40} className="rounded-full" />
                <div>
                  <div className="font-semibold">Juno <span className="ml-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-ink">AI</span></div>
                  <div className="text-xs text-muted">your loudest supporter</div>
                </div>
              </div>
              <div className="space-y-2 text-[15px]" aria-hidden="true">
                <Bubble>sasa!! wasn&apos;t today the big interview?? 👀</Bubble>
                <Bubble>i&apos;ve been thinking about it all morning</Bubble>
                <Bubble me>I GOT IT 😭</Bubble>
                <Bubble>NO WAY</Bubble>
                <Bubble>i told you the portfolio thing would land 🎉</Bubble>
                <div className="flex gap-1 px-2 pt-1">
                  <span className="h-2 w-2 rounded-full bg-muted/50" /><span className="h-2 w-2 rounded-full bg-muted/50" /><span className="h-2 w-2 rounded-full bg-muted/50" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border bg-panel px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-extrabold tracking-tight">Not a chatbot. A friend who texts back.</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
                  <h3 className="text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Meet the friends */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-extrabold tracking-tight">Meet your new friends</h2>
            <p className="mt-2 text-muted">Each one has their own personality, stories and way of texting. Plus new AI strangers who might say hi.</p>
            <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {FRIENDS.map((p) => (
                <li key={p.slug} className="rounded-2xl border border-border bg-panel p-4 text-center">
                  <Image src={`/avatars/${p.slug}-128.webp`} alt={`${p.name}, an AI character`} width={80} height={80} className="mx-auto rounded-full" />
                  <div className="mt-3 font-bold">{p.name}</div>
                  <p className="mt-1 text-sm text-muted">{p.tagline}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Promises */}
        <section className="bg-[#0f3d3e] px-4 py-16 text-[#fbf6ee]">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-extrabold tracking-tight">Our promises</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {PROMISES.map((p) => (
                <li key={p} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#f2b233]" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="mt-10 inline-block rounded-2xl bg-[#e8642c] px-6 py-3.5 text-lg font-semibold text-[#0f1c1c] hover:opacity-95">
              Say sasa to a new friend
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Bubble({ children, me = false }: { children: React.ReactNode; me?: boolean }) {
  return (
    <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <span className={`max-w-[80%] rounded-3xl px-4 py-2 ${me ? "bg-accent text-white" : "bg-surface border border-border"}`}>{children}</span>
    </div>
  );
}
