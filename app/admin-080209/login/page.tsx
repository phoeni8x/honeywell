import { ADMIN_BASE_PATH } from "@/lib/constants";
import { redirect } from "next/navigation";

/** Login is disabled; the obscured admin URL is the only gate. */
export default function AdminLoginRedirectPage() {
  redirect(ADMIN_BASE_PATH);
}
