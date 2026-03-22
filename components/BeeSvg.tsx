"use client";

import clsx from "clsx";

type Props = {
  className?: string;
  sad?: boolean;
  size?: number;
};

/** Decorative bee — black body, amber stripes, wings. Optional sad (X) eyes for game over. */
export function BeeSvg({ className, sad = false, size = 64 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={clsx("animate-bee-float text-[var(--color-black)]", className)}
      aria-hidden
    >
      <ellipse cx="32" cy="36" rx="18" ry="13" fill="currentColor" />
      <path
        d="M18 36 Q32 28 46 36"
        fill="none"
        stroke="#f5a800"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M20 40 Q32 44 44 40"
        fill="none"
        stroke="#f5a800"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <ellipse cx="22" cy="32" rx="9" ry="12" fill="rgba(255,255,255,0.9)" transform="rotate(-22 22 32)" />
      <ellipse cx="42" cy="32" rx="9" ry="12" fill="rgba(255,255,255,0.9)" transform="rotate(22 42 32)" />
      {sad ? (
        <>
          <path d="M36 30 L40 34 M40 30 L36 34" stroke="#fff" strokeWidth="1.8" />
          <path d="M44 30 L48 34 M48 30 L44 34" stroke="#fff" strokeWidth="1.8" />
        </>
      ) : (
        <>
          <circle cx="40" cy="34" r="3.5" fill="#1a1a00" />
          <circle cx="46" cy="34" r="3.5" fill="#1a1a00" />
          <circle cx="41.2" cy="33" r="1" fill="#fff" />
          <circle cx="47.2" cy="33" r="1" fill="#fff" />
        </>
      )}
    </svg>
  );
}
