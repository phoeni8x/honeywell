import { Suspense } from "react";
import AdminDashboard from "../AdminDashboard";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="text-honey-muted">Loading dashboard…</div>}>
      <AdminDashboard />
    </Suspense>
  );
}
