import { AdminPanelShell } from "@/components/AdminPanelShell";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminPanelShell>{children}</AdminPanelShell>;
}
