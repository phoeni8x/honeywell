import { redirect } from "next/navigation";

/** Crypto payment checkout is disabled — send customers to orders. */
export default function CryptoPayDisabledPage() {
  redirect("/order-history");
}
