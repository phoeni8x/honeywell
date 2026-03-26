import { createServiceClient } from "@/lib/supabase/admin";

export async function isCustomerBanned(customerToken: string): Promise<boolean> {
  const token = customerToken.trim();
  if (!token) return false;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("customer_moderation")
    .select("is_banned")
    .eq("customer_token", token)
    .maybeSingle();
  return Boolean(data?.is_banned);
}
