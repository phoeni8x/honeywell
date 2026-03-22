import { Suspense } from "react";
import { HomePageInner } from "./HomePageInner";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-honey-muted">Loading…</div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}
