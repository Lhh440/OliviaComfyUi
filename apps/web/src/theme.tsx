import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CSS_VAR_MAP, THEMES } from "@olivia/design";
import type { ThemeKey, ThemeTokens } from "@olivia/design";

// ADR-0001：同源共享 localStorage，启动器所有 key 一律 olivia. 前缀
const STORAGE_KEY = "olivia.theme";

function readInitialTheme(): ThemeKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in THEMES) return saved as ThemeKey;
  } catch {
    // localStorage 可能被隐私模式禁用：退回默认主题即可，功能不受影响
  }
  return "graphite";
}

interface ThemeContextValue {
  theme: ThemeKey;
  setTheme: (key: ThemeKey) => void;
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(readInitialTheme);

  useEffect(() => {
    const t = THEMES[theme].t;
    const root = document.documentElement;
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
      root.style.setProperty(cssVar, t[key as keyof ThemeTokens]);
    }
  }, [theme]);

  const setTheme = useCallback((key: ThemeKey) => {
    setThemeState(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // 同 readInitialTheme
    }
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, tokens: THEMES[theme].t }),
    [theme, setTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 必须在 ThemeProvider 内使用");
  return ctx;
}
