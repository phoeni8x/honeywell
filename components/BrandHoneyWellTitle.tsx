"use client";

import clsx from "clsx";

/** Classic rainbow cycle for letter colors */
const LETTER_COLORS = [
  "#ff1744",
  "#ff9100",
  "#ffea00",
  "#00e676",
  "#00b0ff",
  "#651fff",
  "#d500f9",
  "#ff4081",
];

const BRAND = "HONEY WELL";

export function RainbowHexLogo({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "relative isolate flex h-10 w-10 shrink-0 items-center justify-center",
        className
      )}
      aria-hidden
    >
      <span className="rainbow-hex-glow pointer-events-none absolute inset-[-5px] hex-clip" />
      <span className="relative z-10 flex h-[86%] w-[86%] items-center justify-center hex-clip bg-hive-black">
        <span className="rainbow-h-letter font-display text-sm font-bold">H</span>
      </span>
    </span>
  );
}

export function BrandHoneyWellTitle({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeCls =
    size === "sm"
      ? "text-base tracking-[0.14em] sm:text-lg sm:tracking-[0.18em] md:text-xl md:tracking-[0.2em]"
      : size === "lg"
        ? "text-2xl tracking-[0.18em] sm:text-3xl sm:tracking-[0.22em] md:text-5xl md:tracking-[0.28em]"
        : "text-xl tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em] md:text-3xl md:tracking-[0.24em]";

  return (
    <span
      className={clsx("inline-flex flex-wrap items-baseline justify-center gap-0", sizeCls, className)}
      aria-label="Honey Well"
    >
      {BRAND.split("").map((ch, i) => {
        if (ch === " ") {
          return <span key={`sp-${i}`} className="inline-block w-2 sm:w-3 md:w-4" aria-hidden />;
        }
        const color = LETTER_COLORS[i % LETTER_COLORS.length];
        return (
          <span
            key={i}
            className="inline-block font-display font-bold animate-honey-letter-bounce"
            style={{
              color,
              animationDelay: `${i * 0.1}s`,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
