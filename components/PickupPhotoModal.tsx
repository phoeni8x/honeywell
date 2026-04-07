"use client";

import { PUBLIC_ERROR_TRY_AGAIN_OR_GUEST } from "@/lib/public-error";
import { ImagePlus, X, CheckCircle } from "lucide-react";
import { useRef, useState } from "react";

interface PickupPhotoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
  /** Customer finished at locker without uploading a photo — notifies admin / updates order. */
  onNoPhotoComplete?: () => Promise<void>;
}

export function PickupPhotoModal({
  open,
  onClose,
  onSubmit,
  onNoPhotoComplete,
}: PickupPhotoModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);

  if (!open) return null;

  function handleClose() {
    setPreview(null);
    setSelectedFile(null);
    setError(null);
    setUploaded(false);
    onClose();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setError("Please choose a valid image file (JPG, PNG, or WebP).");
      return;
    }
    setError(null);
    setSelectedFile(file);
    // Show preview
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  async function handleUpload() {
    if (!selectedFile) {
      // No file selected yet - open file picker
      inputRef.current?.click();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(selectedFile);
      setUploaded(true);
    } catch {
      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close"
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-t-3xl border border-honey-border bg-surface shadow-2xl dark:bg-surface-dark sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
      >
        {/* Drag handle for mobile */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-honey-border/60 sm:hidden" />

        <div className="p-6">
          {/* Header */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-honey-muted hover:bg-honey-border/50"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

          <h2 className="font-display text-2xl text-honey-text">
            Pickup proof
          </h2>
          <p className="mt-2 text-sm text-honey-muted">
            Upload a photo showing you&apos;ve collected your order.
          </p>

          {/* Image preview or placeholder */}
          <div
            className="mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-honey-border bg-bg/50 transition hover:border-primary/40"
            onClick={() => !uploaded && inputRef.current?.click()}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-honey-muted">
                <ImagePlus className="h-10 w-10 opacity-50" />
                <p className="text-sm font-medium">
                  {uploaded ? "Photo uploaded ✓" : "Tap to choose a photo"}
                </p>
                <p className="text-xs">JPG, PNG, or WebP</p>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {uploaded && (
            <p className="mt-3 text-center text-sm font-semibold text-green-600 dark:text-green-400">
              ✓ Photo submitted successfully!
            </p>
          )}

          {loading && (
            <p className="mt-3 text-center text-sm text-honey-muted">
              Uploading…
            </p>
          )}

          {/* Two action buttons */}
          <div className="mt-5 flex gap-3">
            {/* Upload photo button */}
            <button
              type="button"
              disabled={loading || uploaded}
              onClick={() => {
                if (selectedFile) {
                  void handleUpload();
                } else {
                  inputRef.current?.click();
                }
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary/10 py-3.5 text-sm font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              {loading
                ? "Uploading…"
                : selectedFile && !uploaded
                ? "Send photo"
                : "Upload photo"}
            </button>

            {/* Done / collected without photo */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (uploaded) {
                  handleClose();
                  return;
                }
                if (onNoPhotoComplete) {
                  setError(null);
                  setLoading(true);
                  void onNoPhotoComplete()
                    .then(() => {
                      setUploaded(true);
                      handleClose();
                    })
                    .catch(() => {
                      setError(PUBLIC_ERROR_TRY_AGAIN_OR_GUEST);
                    })
                    .finally(() => setLoading(false));
                  return;
                }
                handleClose();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary-light active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {uploaded ? "Done" : onNoPhotoComplete ? "Collected (no photo)" : "Close"}
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-honey-muted">
            {onNoPhotoComplete
              ? "Upload a photo with Send photo, or tap Collected (no photo) if you already took your parcel."
              : "Upload proof with Send photo, then tap Done."}
          </p>
        </div>
      </div>
    </div>
  );
}
