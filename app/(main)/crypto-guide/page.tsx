import { redirect } from "next/navigation";

/** Crypto guide content lives on Home — keep URL working for old links. */
export default function CryptoGuideRedirectPage() {
  redirect("/home#crypto-guide");
}
