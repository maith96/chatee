// Sasamigo brand mark and wordmark. Source artwork: public/brand/ (made by scripts/make-logo.py).

const BUBBLE = "M74.5 172.8A92 86 0 1 0 28.8 138.8Q38.5 150.5 34.1 159.5L24.5 179Q20 188.5 29.5 185L51.4 171.5Q60 166.5 74.5 172.8Z";

/** The chat-bubble mark: orange bubble, white typing-dot face. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden className="shrink-0">
      <path d={BUBBLE} fill="var(--brand)" />
      <circle cx="71" cy="84" r="12.5" fill="#fff" />
      <circle cx="106" cy="84" r="12.5" fill="#fff" />
      <circle cx="141" cy="84" r="12.5" fill="#fff" />
      <path d="M80 117C89 133 123 133 132 117" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
    </svg>
  );
}

/** "sasa" + "migo" in the brand colours. */
export function Wordmark({ className = "text-xl" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-text">sasa</span>
      <span className="text-brand">migo</span>
    </span>
  );
}
