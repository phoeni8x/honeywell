"use client";

import { LS_THEME } from "@/lib/constants";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  mounted: boolean;
}>({ theme: "light", setTheme: () => {}, mounted: false });

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LS_THEME) as Theme | null;
    const prefersDark =
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    setThemeState(initial);
    applyThemeToDom(initial);
    setMounted(true);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(LS_THEME, t);
    applyThemeToDom(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
