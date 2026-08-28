'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export const ADMIN_THEMES = [
  { id: 'light', labelKey: 'light', swatch: '#199ACA' },
  { id: 'dark', labelKey: 'dark', swatch: '#2EB6DE' },
  { id: 'aurora', labelKey: 'aurora', swatch: 'linear-gradient(135deg,#7c5cff,#22d3ee)' },
  { id: 'brutal', labelKey: 'brutal', swatch: '#ff4d00' },
  { id: 'midnight', labelKey: 'midnight', swatch: '#C6DA34' },
  { id: 'lime', labelKey: 'lime', swatch: '#9AAA18' },
  { id: 'contrast', labelKey: 'contrast', swatch: '#EAB616' },
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
