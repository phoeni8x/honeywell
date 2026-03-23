"use client";

import Image from "next/image";

/** Matches `images.remotePatterns` in next.config — anything else uses `<img>` to avoid runtime crashes. */
const SUPABASE_PUBLIC_STORAGE =
  /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//;

export function canDisplayProductImageUrl(src: string | null | undefined): boolean {
  if (src == null || !String(src).trim()) return false;
  return parseSafeImageSrc(String(src)) !== null;
}

function parseSafeImageSrc(src: string): { next: true; href: string } | { next: false; href: string } | null {
  const t = src.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const href = u.href;
    if (u.protocol === "https:" && SUPABASE_PUBLIC_STORAGE.test(href)) {
      return { next: true, href };
    }
    return { next: false, href };
  } catch {
    return null;
  }
}

export function ProductImage({
  src,
  alt,
  fill,
  className,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const parsed = parseSafeImageSrc(src);
  if (!parsed) return null;

  if (parsed.next) {
    return (
      <Image
        src={parsed.href}
        alt={alt}
        fill={fill}
        className={className}
        priority={priority}
        sizes={sizes}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fallback for non-allowlisted URLs (avoids Next/Image production crash)
    <img
      src={parsed.href}
      alt={alt}
      className={className}
      {...(fill
        ? {
            style: {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            },
          }
        : {})}
    />
  );
}
