import type { Metadata } from "next";

// The login page is a client component, so its metadata lives here.
// Not indexed: a sign-in form isn't useful in search results (the landing page is).
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create your Sasamigo account. For adults 18+.",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
