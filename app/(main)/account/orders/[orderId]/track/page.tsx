import { redirect } from "next/navigation";

/** Live delivery tracking was removed; orders use dead drop only. */
export default function DeliveryTrackRedirectPage() {
  redirect("/order-history");
}
