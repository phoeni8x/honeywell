import { redirect } from "next/navigation";

/** Pickup points removed — fulfillment is dead drop only. */
export default function AdminPickupPointsRedirectPage() {
  redirect("/admin-080209/dead-drops");
}
