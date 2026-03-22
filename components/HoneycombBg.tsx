"use client";

import clsx from "clsx";

type Props = {
  className?: string;
  opacity?: number;
  variant?: "light" | "dark";
};

/** Full-area SVG honeycomb pattern for hero, splash, shop header, tracking. */
export function HoneycombBg({ className, opacity = 0.12, variant = "light" }: Props) {
  const stroke = variant === "dark" ? "#f5a800" : "#1a1a00";
  const fill = variant === "dark" ? "#f5a800" : "#f5a800";

  return (
    <div
      className={clsx("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="hw-honeycomb" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
            <path
              d="M28 2 L52 16 L52 44 L28 58 L4 44 L4 16 Z"
              fill="none"
              stroke={stroke}
              strokeWidth="0.8"
              opacity={opacity}
            />
            <path
              d="M28 52 L52 66 L52 94 L28 108 L4 94 L4 66 Z"
              fill="none"
              stroke={stroke}
              strokeWidth="0.8"
              opacity={opacity}
            />
            <path
              d="M56 28 L80 42 L80 70 L56 84 L32 70 L32 42 Z"
              fill="none"
              stroke={stroke}
              strokeWidth="0.8"
              opacity={opacity}
            />
            <path
              d="M0 28 L24 42 L24 70 L0 84 L-24 70 L-24 42 Z"
              fill="none"
              stroke={stroke}
              strokeWidth="0.8"
              opacity={opacity * 0.8}
            />
          </pattern>
          <pattern id="hw-honeycomb-fill" width="56" height="100" patternUnits="userSpaceOnUse">
            <path d="M28 2 L52 16 L52 44 L28 58 L4 44 L4 16 Z" fill={fill} fillOpacity={opacity * 0.35} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hw-honeycomb-fill)" />
        <rect width="100%" height="100%" fill="url(#hw-honeycomb)" />
      </svg>
    </div>
  );
}
