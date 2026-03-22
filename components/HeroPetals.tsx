export function HeroPetals() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible opacity-[0.12] dark:opacity-[0.08]"
      aria-hidden
    >
      <defs>
        <linearGradient id="petalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </linearGradient>
      </defs>
      <ellipse cx="12%" cy="18%" rx="80" ry="40" fill="url(#petalGrad)" transform="rotate(-25 12% 18%)" />
      <ellipse cx="88%" cy="22%" rx="60" ry="32" fill="url(#petalGrad)" transform="rotate(35 88% 22%)" />
      <ellipse cx="78%" cy="78%" rx="70" ry="36" fill="url(#petalGrad)" transform="rotate(-15 78% 78%)" />
      <ellipse cx="15%" cy="72%" rx="50" ry="28" fill="url(#petalGrad)" transform="rotate(20 15% 72%)" />
    </svg>
  );
}
