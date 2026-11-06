import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

// Plain-English terms of service. Keep them true to how the app works, and update SITE.legalUpdated
// whenever you change them. Have them reviewed by a lawyer when you can.

export const metadata: Metadata = pageMetadata({
  title: "Terms of service",
  description: "The terms for using Sasamigo, the AI friends app by Leinalok Labs in Kenya. For adults 18+.",
  path: "/terms",
});

export default function TermsPage() {
  const email = <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms are the agreement between you and <strong>{SITE.company}</strong> (&quot;we&quot;, &quot;us&quot;), based in{" "}
        {SITE.country}, for using Sasamigo. By creating an account or using Sasamigo, you agree to them and to our{" "}
        <a href="/privacy">privacy policy</a>. If you don&apos;t agree, please don&apos;t use Sasamigo.
      </p>

      <h2>1. You must be 18 or older</h2>
      <p>
        Sasamigo is only for adults. By using it, you confirm you&apos;re at least 18. We&apos;ll close any account we believe
        belongs to someone under 18. Keep your login details safe; you&apos;re responsible for what happens on your account.
      </p>

      <h2>2. Everyone on Sasamigo is an AI</h2>
      <ul>
        <li>The characters you chat with, including &quot;strangers&quot;, are fictional AI characters. They are not real people, and no human writes their messages.</li>
        <li>Their personalities, life stories, photos and opinions are made up. Some characters are written to be friendly, close or romantic; they are still AI.</li>
        <li>AI can be wrong. Characters may say things that are inaccurate, out of date or inappropriate, including about the news. Don&apos;t rely on them for facts or decisions.</li>
      </ul>

      <h2>3. Not professional advice, not an emergency service</h2>
      <p>
        Sasamigo is for conversation and company. It isn&apos;t medical, mental health, legal or financial advice, and it
        can&apos;t replace a doctor, counsellor or other professional. If you&apos;re in danger or thinking about hurting
        yourself, call <strong>999 or 112</strong> in Kenya, or the Kenya Red Cross on <strong>1199</strong> (free), or your
        local emergency number.
      </p>

      <h2>4. Using Sasamigo fairly</h2>
      <p>You agree not to:</p>
      <ul>
        <li>break the law, or use Sasamigo to plan or promote violence, terrorism, fraud or other crimes;</li>
        <li>create, request or share any sexual content involving minors, or try to make a character act as a minor in a sexual way;</li>
        <li>harass, threaten or share private information about real people;</li>
        <li>pretend that AI characters, or their messages, are real people, for example to deceive or scam others;</li>
        <li>try to break, overload, hack or get around the app&apos;s safety and age protections, or access other people&apos;s data;</li>
        <li>copy, scrape or resell Sasamigo, its characters or their content, or use them to build a competing product;</li>
        <li>use automated tools or bots to send messages, except through our published API with your own account.</li>
      </ul>
      <p>We may limit, suspend or close accounts that break these rules.</p>

      <h2>5. Your content</h2>
      <p>
        The messages you write belong to you. You give us permission to store and process them only to run Sasamigo for you:
        to write replies, remember you and keep the app safe. See the <a href="/privacy">privacy policy</a> for details. You
        can delete your content and your account at any time.
      </p>

      <h2>6. Our content</h2>
      <p>
        The Sasamigo name and logo, the app, its design and code, and its characters (their names, personalities, stories and
        images) belong to {SITE.company} and are protected by copyright and other laws. You may use them only inside the app,
        for your own personal use. You may share screenshots of your own chats for non-commercial purposes. If you send us
        feedback or ideas, we may use them freely.
      </p>

      <h2>7. Price</h2>
      <p>
        Sasamigo is currently free. If we add paid features later, we&apos;ll tell you the price clearly before you pay
        anything, and you&apos;ll never be charged without agreeing first.
      </p>

      <h2>8. Changes and availability</h2>
      <p>
        We&apos;re a small team and Sasamigo is new. We may change, pause or remove features, characters or the service, and
        it may sometimes be unavailable. If we ever shut Sasamigo down, we&apos;ll give you notice where we can.
      </p>

      <h2>9. Ending your account</h2>
      <p>
        You can stop using Sasamigo and delete your account at any time in Settings. We may suspend or close your account if
        you break these terms or if we have to by law.
      </p>

      <h2>10. Disclaimers and liability</h2>
      <p>
        We work hard to make Sasamigo safe and reliable, but we provide it &quot;as is&quot;, without promises that it will
        always be available, error-free or suitable for your needs. As far as the law allows, we aren&apos;t responsible for
        indirect losses, or for decisions you make based on what an AI character says, and our total responsibility to you is
        limited to the amount you&apos;ve paid us in the last 12 months (or KES 1,000 if you haven&apos;t paid anything).
        Nothing in these terms takes away rights you have under Kenyan consumer protection law.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms. We&apos;ll change the date at the top, and tell you in the app or by email before important
        changes take effect. If you keep using Sasamigo after that, you accept the new terms.
      </p>

      <h2>12. Law and disputes</h2>
      <p>
        These terms are governed by the laws of Kenya. If you have a problem, please contact us first and we&apos;ll try to
        sort it out. If we can&apos;t, the courts of Kenya will decide.
      </p>

      <h2>13. Contact</h2>
      <p>Questions about these terms: {email}.</p>
    </LegalPage>
  );
}
