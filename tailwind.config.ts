import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        "bg-dark": "var(--color-bg-dark)",
        surface: "var(--color-surface)",
        "surface-dark": "var(--color-surface-dark)",
        primary: "var(--color-primary)",
        "primary-light": "var(--color-primary-light)",
        "primary-dark": "var(--color-primary-dark)",
        accent: "var(--color-accent)",
        blush: "var(--color-blush)",
        hive: {
          black: "var(--color-black)",
        },
        "on-primary": "var(--color-text-on-primary)",
        honey: {
          text: "var(--color-text)",
          muted: "var(--color-text-muted)",
          border: "var(--color-border)",
        },
      },
      fontFamily: {
        display: ["var(--font-cinzel)", "Georgia", "serif"],
        body: ["var(--font-dm)", "system-ui", "sans-serif"],
        accent: ["var(--font-caveat)", "cursive"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "gradient-shift": "gradientShift 12s ease infinite",
        ticker: "ticker 28s linear infinite",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "confetti-fall": "confettiFall 2.4s ease-out forwards",
        "hex-pulse": "hexPulse 1.6s ease-in-out infinite",
        "bee-float": "beeFloat 4s ease-in-out infinite",
        buzz: "buzz 0.35s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        confettiFall: {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(110vh) rotate(540deg)", opacity: "0.65" },
        },
        hexPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 168, 0, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(245, 168, 0, 0)" },
        },
        beeFloat: {
          "0%, 100%": { transform: "translateX(0) rotate(-3deg)" },
          "50%": { transform: "translateX(12px) rotate(3deg)" },
        },
        buzz: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-4deg)" },
          "75%": { transform: "rotate(4deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
