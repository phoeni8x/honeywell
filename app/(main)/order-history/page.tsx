import { Suspense } from "react";
import { OrderHistoryContent } from "./OrderHistoryContent";

export default function OrderHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-honey-muted">Loading orders…</div>
      }
    >
      <OrderHistoryContent />
    </Suspense>
  );
}
