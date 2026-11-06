import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

// Plain-English privacy policy written for Kenya's Data Protection Act, 2019.
// Keep it TRUE: if the app starts collecting something new, or you change providers, update this page
// and SITE.legalUpdated. Have it reviewed by a lawyer or the ODPC's guidance when you can.

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description: "How Sasamigo handles your data under Kenya's Data Protection Act, 2019: what we collect, why, and how to see or delete it.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const email = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
  return (
    <LegalPage title="Privacy policy">
      <p>
        Sasamigo is an app where you text AI characters. It&apos;s run by <strong>{SITE.company}</strong>, based in {SITE.country}
        (&quot;we&quot;, &quot;us&quot;). This page explains, in plain words, what we collect, why, who helps us run the app,
        and what you can do about it. We follow Kenya&apos;s Data Protection Act, 2019.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Everyone you talk to on Sasamigo is an AI, never a real person.</li>
        <li>We keep your chats so your Sasamigo friends can remember you. You can see and delete what they remember, and delete your whole account at any time.</li>
        <li>We don&apos;t sell your data, we don&apos;t show ads, and we don&apos;t use advertising trackers.</li>
        <li>Your messages are sent to AI providers to write the replies. We don&apos;t allow them to use your chats to train their models.</li>
        <li>Sasamigo is only for adults (18+).</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and password (stored scrambled, never readable). If you sign in with Google, we get your name, email and profile picture from Google.</li>
        <li><strong>Age confirmation:</strong> you give your date of birth when you sign up. We only save <em>that</em> you confirmed you&apos;re 18 or older, never the date itself.</li>
        <li><strong>Your chats:</strong> the messages you send and the replies you get.</li>
        <li><strong>Memories:</strong> short notes our system picks out of your chats so characters can remember you (for example, &quot;has a sister called Wanjiru&quot;). You can see and delete them in the 🧠 Memory panel.</li>
        <li><strong>How you like to chat:</strong> your 👍/👎 ratings and the reasons you pick, and simple patterns such as whether you prefer short replies. Characters use these to adjust their style. You can reset or switch this off in Settings.</li>
        <li><strong>News interests:</strong> your time zone (to guess your region), the regions and topics you choose, and whether you chatted about a news story a character brought up. We note <em>that</em> you engaged, not what you said.</li>
        <li><strong>Strangers:</strong> which AI strangers you were introduced to and whether you replied, ignored or blocked them. To suggest strangers, we group people only by region, texting style and news interests, never by gender, ethnicity or looks.</li>
        <li><strong>Technical data:</strong> basic logs our hosting providers keep (such as IP address, browser type and errors), used to keep the app secure and working.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the app: show your chats, write replies, remember you and keep your settings. (This is needed to provide the service you signed up for.)</li>
        <li>To keep people safe: we automatically check messages for signs that someone may be in crisis, so we can always show helpline numbers, and for statements that suggest a user is under 18.</li>
        <li>To improve Sasamigo: we look at <strong>totals and averages</strong> (such as how many replies got a 👍), never individual chats, and only for groups of at least 5 people.</li>
        <li>To meet legal obligations and to protect our users and our service.</li>
      </ul>
      <p>
        <strong>Who can read your chats:</strong> nobody at {SITE.company} reads your conversations as part of normal work. We
        only look at a specific conversation if we must: to investigate abuse or a safety concern, to fix a problem you&apos;ve
        reported to us, or because the law requires it.
      </p>

      <h2>Sensitive information</h2>
      <p>
        People sometimes share personal things in chats, such as feelings, health or relationships. You choose what to share,
        and you&apos;re never required to share sensitive information. We only use it to reply to you and remember what you
        told us, and we protect it like the rest of your data. You can delete any memory, or your whole account, at any time.
      </p>

      <h2>Who helps us run Sasamigo</h2>
      <p>We use a few trusted service providers. They only process your data to provide their service to us:</p>
      <ul>
        <li><strong>Supabase</strong>: stores our database and handles sign-in.</li>
        <li><strong>Vercel</strong>: hosts the website and app.</li>
        <li><strong>NVIDIA</strong> and <strong>Google (Gemini)</strong>: AI models that write the characters&apos; replies, pick out memories and summarise the news. They receive the messages needed to do that. We use their API services under terms that don&apos;t allow them to use your conversations to train their models.</li>
        <li><strong>Google</strong>: &quot;Continue with Google&quot; sign-in, if you use it.</li>
        <li><strong>Our email provider</strong>: sends sign-up and password emails.</li>
      </ul>
      <p>
        Some of these providers store or process data outside Kenya, for example in the European Union or the United States.
        When your data leaves Kenya, we only use providers with strong security and data protection commitments, as the Data
        Protection Act requires.
      </p>
      <p>We never sell your personal data, and we don&apos;t share it with advertisers.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>We keep your account, chats and memories until you delete them or delete your account.</li>
        <li>When you delete your account (Settings → Delete my account), everything is deleted straight away. Copies may remain in our providers&apos; backups for up to 30 days before they&apos;re gone for good.</li>
        <li>Hosting logs are kept for a short time by our providers for security.</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under Kenya&apos;s Data Protection Act you have the right to:</p>
      <ul>
        <li>know how your data is used (this page);</li>
        <li>get a copy of your personal data;</li>
        <li>correct data that&apos;s wrong;</li>
        <li>delete your data: delete memories in the app, or your whole account in Settings;</li>
        <li>object to some uses of your data, such as style learning (switch it off in Settings);</li>
        <li>ask us to send your data to you in a common format.</li>
      </ul>
      <p>
        To use any of these rights, email {email}. We&apos;ll reply within 14 days. If you&apos;re not happy with how we handled
        your request, you can complain to the Office of the Data Protection Commissioner (ODPC) at{" "}
        <a href="https://www.odpc.go.ke" target="_blank" rel="noreferrer">odpc.go.ke</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        We only use the cookies needed to keep you signed in. We don&apos;t use advertising or tracking cookies.
      </p>

      <h2>Security</h2>
      <p>
        Your data is sent over encrypted connections (HTTPS) and stored with access controls, so each person can only reach
        their own chats. No system is perfectly secure, so please use a strong password. If a breach ever affects your
        personal data, we&apos;ll tell you and the Data Protection Commissioner as the law requires.
      </p>

      <h2>Adults only</h2>
      <p>
        Sasamigo is only for people aged 18 or over. If we learn that someone under 18 is using it, we&apos;ll close the
        account and delete its data.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change this policy, we&apos;ll update the date at the top. If the change is important, we&apos;ll tell you in the
        app or by email before it takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests about your privacy: {email} ({SITE.company}, {SITE.country}).
      </p>
    </LegalPage>
  );
}
