import { ADMIN_BASE_PATH } from "@/lib/constants";
import { redirect } from "next/navigation";

/** Legacy route — parcel lockers are managed from Orders (issue locker). */
export default function AdminDeadDropsRedirectPage() {
  redirect(`${ADMIN_BASE_PATH}?tab=orders`);
}
