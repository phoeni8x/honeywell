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

function letterSpan(ch: string, globalIndex: number) {
  const color = LETTER_COLORS[globalIndex % LETTER_COLORS.length];
  return (
    <span
      key={`${ch}-${globalIndex}`}
      className="inline-block font-display font-bold animate-honey-letter-bounce"
      style={{
        color,
        animationDelay: `${globalIndex * 0.1}s`,
      }}
    >
      {ch}
    </span>
  );
}

/** Per-letter rainbow + bounce (matches brand title treatment). */
export function RainbowHeading({
  text,
  className,
  as: Comp = "h2",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
}) {
  let letterIndex = 0;
  return (
    <Comp className={clsx("text-balance", className)} aria-label={text}>
      {text.split("").map((ch, i) => {
        if (ch === " ") {
          return (
            <span key={`sp-${i}`} className="inline-block w-2 sm:w-2.5" aria-hidden>
              {" "}
            </span>
          );
        }
        return letterSpan(ch, letterIndex++);
      })}
    </Comp>
  );
}

export function BrandHoneyWellTitle({
  size = "md",
  className,
  spread = false,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Navbar: fill horizontal space with letters spread evenly (two words). */
  spread?: boolean;
}) {
  const sizeCls =
    size === "sm"
      ? "text-base tracking-[0.14em] sm:text-lg sm:tracking-[0.18em] md:text-xl md:tracking-[0.2em]"
      : size === "lg"
        ? "text-2xl tracking-[0.18em] sm:text-3xl sm:tracking-[0.22em] md:text-5xl md:tracking-[0.28em]"
        : "text-xl tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em] md:text-3xl md:tracking-[0.24em]";

  const words = BRAND.split(" ");

  if (spread) {
    const smSpread =
      size === "sm"
        ? "text-[clamp(0.7rem,3.4vw,1rem)] sm:text-base md:text-xl lg:text-2xl"
        : size === "lg"
          ? sizeCls
          : "text-xl sm:text-2xl md:text-3xl";

    let globalIndex = 0;
    return (
      <span
        className={clsx(
          "flex min-h-[1.25em] min-w-0 flex-1 items-baseline gap-1.5 sm:gap-4 md:gap-8 lg:gap-14",
          smSpread,
          className
        )}
        aria-label="Honey Well"
      >
        {words.map((word) => (
          <span key={word} className="flex min-w-0 flex-1 justify-evenly" style={{ flexBasis: 0 }}>
            {word.split("").map((ch) => letterSpan(ch, globalIndex++))}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span
      className={clsx("inline-flex flex-wrap items-baseline justify-center gap-0", sizeCls, className)}
      aria-label="Honey Well"
    >
      {BRAND.split("").map((ch, i) => {
        if (ch === " ") {
          return <span key={`sp-${i}`} className="inline-block w-2 sm:w-3 md:w-4" aria-hidden />;
        }
        return letterSpan(ch, i);
      })}
    </span>
  );
}
