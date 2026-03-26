import { CustomerBootstrap } from "@/components/CustomerBootstrap";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { ShopCurrencyProvider } from "@/components/ShopCurrencyProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WalletProvider } from "@/lib/WalletContext";
import type { Metadata, Viewport } from "next";
import { Caveat, Cinzel, DM_Sans } from "next/font/google";
import Script from "next/script";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} ${dmSans.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-bg font-body">
        <ThemeProvider>
          <RegisterServiceWorker />
          <CustomerBootstrap />
          <WalletProvider>
            <ShopCurrencyProvider>{children}</ShopCurrencyProvider>
          </WalletProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
      // Scroll focused input into view on mobile when keyboard opens
      if (typeof window !== 'undefined') {
        function handleInputFocus(e) {
          var el = e.target;
          if (!el || !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 350);
        }
        document.addEventListener('focusin', handleInputFocus, { passive: true });
        
        // Dismiss keyboard when tapping outside any input
        document.addEventListener('touchend', function(e) {
          var target = e.target;
          if (!target) return;
          var tag = target.tagName;
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            if (document.activeElement && 
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
              document.activeElement.blur();
            }
          }
        }, { passive: true });
      }
    `,
          }}
        />
      </body>
    </html>
  );
}
