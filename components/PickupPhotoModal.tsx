"use client";

import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { X } from "lucide-react";
import { useRef, useState } from "react";

interface PickupPhotoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
}

export function PickupPhotoModal({ open, onClose, onSubmit }: PickupPhotoModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(file);
      onClose();
    } catch (err) {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

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
        <h2 className="font-display text-2xl text-honey-text">Pickup proof</h2>
        <p className="mt-2 text-sm text-honey-muted">
          Please upload a photo showing you&apos;ve collected your order.
        </p>
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-honey-border bg-bg/50 px-4 py-10 transition hover:border-primary/40">
          <span className="text-sm font-medium text-honey-text">Tap to choose an image</span>
          <span className="mt-1 text-xs text-honey-muted">JPG, PNG, or WebP</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChange}
            disabled={loading}
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {loading && <p className="mt-3 text-sm text-honey-muted">Uploading…</p>}
      </div>
    </div>
  );
}
