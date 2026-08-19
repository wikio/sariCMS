'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export const ADMIN_THEMES = [
  { id: 'light', label: 'Clair', swatch: '#199ACA' },
  { id: 'dark', label: 'Sombre', swatch: '#2EB6DE' },
  { id: 'midnight', label: 'Minuit', swatch: '#C6DA34' },
  { id: 'lime', label: 'Lime', swatch: '#9AAA18' },
  { id: 'contrast', label: 'Contraste', swatch: '#EAB616' },
] as const;

export type AdminThemeId = (typeof ADMIN_THEMES)[number]['id'];

interface AdminThemeCtx {
  theme: AdminThemeId;
  setTheme: (id: AdminThemeId) => void;
}

const Ctx = createContext<AdminThemeCtx | undefined>(undefined);
const KEY = 'sari_admin_theme';

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AdminThemeId>('light');

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as AdminThemeId | null;
    if (stored && ADMIN_THEMES.some((t) => t.id === stored)) setThemeState(stored);
  }, []);

  const setTheme = (id: AdminThemeId) => {
    setThemeState(id);
    localStorage.setItem(KEY, id);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminTheme must be used within AdminThemeProvider');
  return ctx;
}
