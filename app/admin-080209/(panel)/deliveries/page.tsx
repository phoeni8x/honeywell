import { ADMIN_BASE_PATH } from "@/lib/constants";
import { redirect } from "next/navigation";

/** Legacy route — use Orders. */
export default function AdminDeliveriesRedirectPage() {
  redirect(`${ADMIN_BASE_PATH}?tab=orders`);
}
