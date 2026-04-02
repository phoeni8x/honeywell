import { CryptoTicker } from "@/components/CryptoTicker";
import { Navbar } from "@/components/Navbar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rainbow-site-bg min-h-screen bg-bg">
      <Navbar />
      <CryptoTicker />
      <main className="page-enter mx-auto max-w-6xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
