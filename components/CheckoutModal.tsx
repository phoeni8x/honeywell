"use client";

import { formatPrice } from "@/lib/helpers";
import { X } from "lucide-react";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
  quantity: number;
  total: number;
  loading?: boolean;
}

export function CheckoutModal({
  open,
  onClose,
  onConfirm,
  productName,
  quantity,
  total,
  loading,
}: CheckoutModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-honey-border bg-surface p-6 shadow-2xl dark:bg-surface-dark">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-honey-muted hover:bg-honey-border/50 hover:text-honey-text"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="font-display text-2xl text-honey-text">Confirm order</h2>
        <p className="mt-1 text-sm text-honey-muted">Review your selection before we reserve stock.</p>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-honey-muted">Product</dt>
            <dd className="max-w-[60%] text-right font-medium text-honey-text">{productName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-honey-muted">Quantity</dt>
            <dd className="font-medium text-honey-text">{quantity}</dd>
          </div>
          <div className="flex justify-between border-t border-honey-border pt-3 text-base">
            <dt className="font-semibold text-honey-text">Total</dt>
            <dd className="font-semibold text-primary">{formatPrice(total)}</dd>
          </div>
        </dl>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-honey-border py-3 text-sm font-semibold text-honey-text transition hover:bg-honey-border/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-light disabled:opacity-60"
          >
            {loading ? "Placing order…" : "Confirm order"}
          </button>
        </div>
      </div>
    </div>
  );
}
