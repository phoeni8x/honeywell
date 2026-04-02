import { redirect } from "next/navigation";

/** Delivery queue removed — all orders use dead drop. */
export default function AdminDeliveriesRedirectPage() {
  redirect("/admin-080209/dead-drops");
}
