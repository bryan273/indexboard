import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const STORE = 'repro.theme2';

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function initialTheme(): Theme {
  try {
    return localStorage.getItem(STORE) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORE, next);
    } catch {
      /* storage unavailable: keep in memory only */
    }
    setTheme(next);
  }, [theme]);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside ThemeProvider');
  return v;
}
