import { redirect } from "next/navigation";

/** Live delivery tracking was removed; orders use parcel lockers. */
export default function DeliveryTrackRedirectPage() {
  redirect("/order-history");
}
