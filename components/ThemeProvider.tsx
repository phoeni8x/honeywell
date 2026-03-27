"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  mounted: boolean;
}>({ theme: "dark", setTheme: () => {}, mounted: false });

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeToDom(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.add("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    applyThemeToDom("dark");
    setMounted(true);
  }, []);

  const setTheme = () => {
    applyThemeToDom("dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
