import { redirect } from "next/navigation";

/** Rates tab was removed; send visitors to Home. */
export default function CryptoRatesRedirectPage() {
  redirect("/home");
}
