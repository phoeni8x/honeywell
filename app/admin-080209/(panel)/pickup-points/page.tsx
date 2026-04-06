import { ADMIN_BASE_PATH } from "@/lib/constants";
import { redirect } from "next/navigation";

/** Legacy route — use Orders. */
export default function AdminPickupPointsRedirectPage() {
  redirect(`${ADMIN_BASE_PATH}?tab=orders`);
}
