"use client";

/** Lightweight celebration overlay — no extra dependencies */
export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;
  const glyphs = ["🎉", "✨", "🌿", "💚", "🍯"];
  const pieces = Array.from({ length: 20 }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          className="absolute animate-confetti-fall text-xl opacity-90 will-change-transform"
          style={{
            left: `${(i * 7) % 96}%`,
            top: "-4%",
            animationDelay: `${i * 45}ms`,
            animationDuration: `${2 + (i % 5) * 0.15}s`,
          }}
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
    </div>
  );
}
