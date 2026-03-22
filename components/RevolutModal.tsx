"use client";

import { ExternalLink, X } from "lucide-react";

interface RevolutModalProps {
  open: boolean;
  onClose: () => void;
  revolutUrl: string;
}

export function RevolutModal({ open, onClose, revolutUrl }: RevolutModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-2xl dark:bg-surface-dark">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-honey-muted hover:bg-honey-border/50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-2xl text-honey-text">Pay with Revolut</h2>
        <p className="mt-2 text-sm text-honey-muted">
          Your order is reserved. Complete payment using the team Revolut link below.
        </p>
        <a
          href={revolutUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-light"
        >
          Open Revolut payment
          <ExternalLink className="h-4 w-4" />
        </a>
        {!revolutUrl && (
          <p className="mt-3 text-xs text-amber-600">Admin has not set a Revolut link yet.</p>
        )}
      </div>
    </div>
  );
}
