"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface RevolutModalProps {
  open: boolean;
  onClose: () => void;
  revolutUrl: string;
  /** Shown above the link so the customer can copy before opening the payment page. */
  paymentReferenceCode?: string;
}

export function RevolutModal({ open, onClose, revolutUrl, paymentReferenceCode }: RevolutModalProps) {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll the button into view when modal opens on mobile
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      buttonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(timer);
  }, [open]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      {/* Modal - slides up from bottom on mobile, centered on desktop */}
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-honey-border bg-surface shadow-2xl dark:bg-surface-dark sm:rounded-2xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
          marginBottom: 0,
        }}
      >
        {/* Drag handle - visual cue for mobile bottom sheet */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-honey-border/60 sm:hidden" />

        <div className="p-6">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-honey-muted hover:bg-honey-border/50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 className="font-display text-2xl text-honey-text">Pay with bank transfer</h2>
          <p className="mt-2 text-sm text-honey-muted">
            Copy your payment reference first, then open your bank transfer link and paste it into the reference / memo
            field before sending.
          </p>
          {paymentReferenceCode ? (
            <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase text-honey-muted">Your reference (required)</p>
              <p className="mt-1 font-mono text-xl font-bold tracking-wider text-primary">{paymentReferenceCode}</p>
            </div>
          ) : null}
          {/* Big tappable button - easy to hit on mobile */}
          <a
            ref={buttonRef}
            href={revolutUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="mt-6 flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-white transition hover:bg-primary-light active:scale-95"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Open bank transfer payment
            <ExternalLink className="h-5 w-5" />
          </a>
          {!revolutUrl && (
            <p className="mt-3 text-center text-xs text-amber-600 dark:text-amber-400">
              Admin has not set a bank transfer link yet.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-2xl border border-honey-border py-3 text-sm font-medium text-honey-muted hover:bg-honey-border/30"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
