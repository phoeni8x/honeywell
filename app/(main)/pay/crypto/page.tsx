import { Suspense } from "react";
import { CryptoPayContent } from "./CryptoPayContent";

export default function CryptoPayPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-honey-muted">Loading…</div>}>
      <CryptoPayContent />
    </Suspense>
  );
}
