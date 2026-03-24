import { CustomerBootstrap } from "@/components/CustomerBootstrap";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { ShopCurrencyProvider } from "@/components/ShopCurrencyProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WalletProvider } from "@/lib/WalletContext";
import type { Metadata } from "next";
import { Caveat, Cinzel, DM_Sans } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  display: "swap",
  weight: ["400", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Honey Well — Fresh flowers & wellness",
  description: "Fresh flowers. Pure wellness. Delivered with care.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${dmSans.variable} ${caveat.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-bg font-body">
        <ThemeProvider>
          <RegisterServiceWorker />
          <CustomerBootstrap />
          <WalletProvider>
            <ShopCurrencyProvider>{children}</ShopCurrencyProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
