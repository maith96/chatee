import type { Metadata } from "next";

// Admin tools: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
