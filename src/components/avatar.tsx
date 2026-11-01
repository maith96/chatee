"use client";

import { useState } from "react";

type AvatarPersona = { name: string; avatar_url: string | null; avatar_emoji: string | null } | null;

const SIZES = { sm: "h-8 w-8 text-base", md: "h-8 w-8 text-base sm:h-10 sm:w-10 sm:text-xl", lg: "h-24 w-24 text-5xl", xl: "h-32 w-32 text-6xl" };

/** Persona avatar image, falling back to its emoji (or the assistant robot) if the image is missing. */
export function Avatar({
  persona,
  size = "md",
  onClick,
}: {
  persona: AvatarPersona;
  size?: keyof typeof SIZES;
  onClick?: () => void; // makes the avatar a button (e.g. to open the profile)
}) {
  const [failed, setFailed] = useState(false);
  const cls = `${SIZES[size]} shrink-0 overflow-hidden rounded-full bg-accent-soft flex items-center justify-center shadow-sm`;
  const face =
    persona?.avatar_url && !failed ? (
      // eslint-disable-next-line @next/next/no-img-element -- small avatars, may be external URLs later
      <img src={persona.avatar_url} alt={persona.name} className={`${cls} object-cover`} onError={() => setFailed(true)} />
    ) : (
      <div className={cls} aria-label={persona?.name ?? "Assistant"}>
        {persona?.avatar_emoji ?? "🤖"}
      </div>
    );
  if (!onClick || !persona) return face;
  return (
    <button type="button" onClick={onClick} aria-label={`View ${persona.name}'s profile`}
      className="shrink-0 rounded-full transition hover:ring-2 hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent">
      {face}
    </button>
  );
}
